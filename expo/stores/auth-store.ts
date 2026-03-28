import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, getDeepLink } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { logger } from '@/utils/logger';

// Helper to add timeout to promises
const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => {
      logger.warn(`Operation timed out after ${timeoutMs}ms, using fallback`);
      resolve(fallbackValue);
    }, timeoutMs))
  ]);
};

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Generate or get device ID
  const generateDeviceId = useCallback(async (): Promise<string> => {
    try {
      // Check if we already have a stored device ID
      const stored = await AsyncStorage.getItem('device_id');
      if (stored) {
        return stored;
      }

      // Generate new device ID
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      const platform = Platform.OS;
      
      const uniqueId = `${platform}_${timestamp}_${random}`;
      
      // Store the generated ID
      try {
        await AsyncStorage.setItem('device_id', uniqueId);
      } catch (e) {
        logger.warn('Could not store device ID:', e);
      }
      
      return uniqueId;
    } catch (error) {
      logger.error('Error generating device ID:', error);
      // Fallback to timestamp + random
      return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }, []);

  // Create anonymous user in database
  const createAnonymousUser = useCallback(async (deviceId: string) => {
    if (!deviceId?.trim()) {
      logger.error('Invalid device ID provided');
      return null;
    }
    
    try {
      // Try to create/update anonymous user record
      // If the table doesn't exist, this will fail gracefully
      const { data, error } = await supabase
        .from('anonymous_users')
        .upsert({
          device_id: deviceId,
          created_at: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          device_info: {
            platform: Platform.OS,
            device_name: Platform.OS === 'web' ? 'Web Browser' : 'Mobile Device',
            os_version: Platform.OS === 'web' ? (typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown') : 'Unknown',
            brand: Platform.OS === 'web' ? 'Web' : 'Mobile'
          }
        }, {
          onConflict: 'device_id'
        })
        .select()
        .single();

      if (error) {
        // If table doesn't exist or other database error, just log it but don't fail
        logger.warn('Could not create anonymous user record (this is OK if table does not exist):', error.message);
        return { device_id: deviceId }; // Return minimal data
      }
      
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('Error in createAnonymousUser (continuing without database record):', errorMessage);
      return { device_id: deviceId }; // Return minimal data
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // First, try to get authenticated session with timeout (3 seconds)
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          3000,
          { data: { session: null }, error: null }
        );
        
        const session = sessionResult?.data?.session;
        
        if (session) {
          // User is authenticated
          setSession(session);
          setUser(session.user);
          setIsAnonymous(false);
        } else {
          // No authenticated user, create anonymous session
          const generatedDeviceId = await generateDeviceId();
          setDeviceId(generatedDeviceId);
          
          // Create anonymous user record in database (don't wait for it)
          createAnonymousUser(generatedDeviceId).catch(error => {
            logger.error('Error creating anonymous user:', error instanceof Error ? error.message : String(error));
          });
          setIsAnonymous(true);
        }
      } catch (error) {
        logger.error('Error initializing auth:', error);
        // Fallback to anonymous mode
        const generatedDeviceId = await generateDeviceId();
        setDeviceId(generatedDeviceId);
        setIsAnonymous(true);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        // Set session and user IMMEDIATELY (don't wait for profile/settings creation)
        // This ensures navigation happens right away
        logger.log('✅ Auth state changed: User authenticated');
        setSession(session);
        setUser(session.user);
        setIsAnonymous(false);
        setDeviceId(null);
        setLoading(false); // Ensure loading is false so navigation can happen
        
        // Create profile and settings in background (non-blocking)
        // Don't await these - let them run in background
        Promise.all([
          // Ensure user profile exists (in case trigger didn't fire)
          (async () => {
            try {
              const { data: existingProfile, error: checkError } = await supabase
                .from('user_profiles')
                .select('id')
                .eq('id', session.user.id)
                .single();
              
              if (checkError && checkError.code === 'PGRST116') {
                // Profile doesn't exist, create it manually
                logger.log('Creating user profile manually...');
                const { error: insertError } = await supabase
                  .from('user_profiles')
                  .insert({
                    id: session.user.id,
                    email: session.user.email,
                    full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || null,
                    avatar_url: session.user.user_metadata?.avatar_url || null,
                    provider: session.user.app_metadata?.provider || 'email',
                    provider_id: session.user.user_metadata?.provider_id || null,
                  });
                
                if (insertError) {
                  logger.error('Error creating user profile:', insertError);
                } else {
                  logger.log('User profile created successfully');
                }
              }
            } catch (error) {
              logger.error('Error checking/creating user profile:', error);
            }
          })(),
          
          // Ensure user settings exist with default values
          (async () => {
            try {
              const { data: existingSettings, error: settingsCheckError } = await supabase
                .from('user_settings')
                .select('id')
                .eq('user_id', session.user.id)
                .single();
              
              if (settingsCheckError && settingsCheckError.code === 'PGRST116') {
                // Settings don't exist, create them with default values
                logger.log('Creating user settings with default values...');
                const { error: settingsInsertError } = await supabase
                  .from('user_settings')
                  .insert({
                    user_id: session.user.id,
                    notifications_enabled: true,
                    vibration_enabled: true,
                    sound_enabled: true,
                    background_tracking_enabled: false,
                    early_warning_enabled: true,
                  });
                
                if (settingsInsertError) {
                  logger.error('Error creating user settings:', settingsInsertError);
                } else {
                  logger.log('User settings created successfully with default values');
                }
              }
            } catch (error) {
              logger.error('Error checking/creating user settings:', error);
            }
          })(),
        ]).catch((error) => {
          logger.warn('⚠️ Error creating profile/settings (non-blocking):', error);
        });
      } else {
        setSession(null);
        setUser(null);
        // Switch back to anonymous mode
        const generatedDeviceId = await generateDeviceId();
        setDeviceId(generatedDeviceId);
        try {
          await createAnonymousUser(generatedDeviceId);
        } catch (error) {
          logger.error('Error creating anonymous user on auth change:', error instanceof Error ? error.message : String(error));
        }
        setIsAnonymous(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [createAnonymousUser, generateDeviceId]);

  const signInWithGoogle = useCallback(async () => {
    try {
      setLoading(true);

      const deepLink = getDeepLink(); // tracksy://auth/callback
      logger.log('🔗 Google OAuth deep link:', deepLink);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: deepLink,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        logger.error('❌ Google signInWithOAuth error:', error);
        throw error;
      }

      logger.log('✅ Google signInWithOAuth success, opening auth session...', data);

      if (Platform.OS !== 'web' && data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          deepLink,
          { showInRecents: true }
        );

        logger.log('📱 Google Auth session result:', result.type, result.url);

        if (result.type === 'success' && result.url) {
          // Вземаме всичко след # или ?, където Supabase връща токените
          const fragment = result.url.split('#')[1] || result.url.split('?')[1] || '';
          const params = new URLSearchParams(fragment);

          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          if (access_token && refresh_token) {
            logger.log('✅ Google tokens extracted, setting session...');
            const { data: { session }, error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });

            if (error) {
              logger.error('❌ Error setting Google session:', error);
              throw error;
            }

            // onAuthStateChange + login.tsx ще поемат навигацията
            logger.log('✅ Google session set successfully');
          } else {
            logger.error('❌ Google callback URL has no tokens:', fragment);
          }
        } else if (result.type === 'cancel') {
          logger.log('⚠️ Google OAuth cancelled by user');
        } else if (result.type === 'dismiss') {
          logger.log('⚠️ Google OAuth dismissed');
        } else {
          logger.error('❌ Google Auth session failed:', result.type);
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      logger.error('Authentication error (Google):', msg);
      if (stack) logger.error('Error stack:', stack);
      if (msg.includes('not supported')) {
        logger.error('OAuth provider not configured in Supabase');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    try {
      setLoading(true);

      const deepLink = getDeepLink(); // tracksy://auth/callback
      logger.log('🔗 Apple OAuth deep link:', deepLink);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: deepLink,
          scopes: 'name email',
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        logger.error('❌ Apple signInWithOAuth error:', error);
        throw error;
      }

      logger.log('✅ Apple signInWithOAuth success, opening auth session...', data);

      if (Platform.OS !== 'web' && data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          deepLink,
          { showInRecents: true }
        );

        logger.log('📱 Apple Auth session result:', result.type, result.url);

        if (result.type === 'success' && result.url) {
          const fragment = result.url.split('#')[1] || result.url.split('?')[1] || '';
          const params = new URLSearchParams(fragment);

          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          if (access_token && refresh_token) {
            logger.log('✅ Apple tokens extracted, setting session...');
            const { data: { session }, error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });

            if (error) {
              logger.error('❌ Error setting Apple session:', error);
              throw error;
            }

            logger.log('✅ Apple session set successfully');
          } else {
            logger.error('❌ Apple callback URL has no tokens:', fragment);
          }
        } else if (result.type === 'cancel') {
          logger.log('⚠️ Apple OAuth cancelled by user');
        } else if (result.type === 'dismiss') {
          logger.log('⚠️ Apple OAuth dismissed');
        } else {
          logger.error('❌ Apple Auth session failed:', result.type);
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      logger.error('Apple Authentication error:', msg);
      if (stack) logger.error('Error stack:', stack);
      if (msg.includes('not supported')) {
        logger.error('OAuth provider not configured in Supabase');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const signInWithFacebook = useCallback(async () => {
    try {
      setLoading(true);
      const deepLink = getDeepLink();
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: deepLink, // Direct deep link - Supabase handles callback automatically
          skipBrowserRedirect: true, // We'll handle the redirect manually
        },
      });

      if (error) throw error;

      if (Platform.OS !== 'web' && data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          deepLink,
          {
            showInRecents: true,
          }
        );

        if (result.type === 'success' && result.url) {
          const params = new URLSearchParams(result.url.split('#')[1]);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          if (access_token && refresh_token) {
            const { data: { session }, error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            
            if (error) throw error;
            setSession(session);
            setUser(session?.user ?? null);
          }
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Authentication error:', msg);
      // Show user-friendly error message
      if (msg.includes('not supported')) {
        logger.error('OAuth provider not configured in Supabase');
      }
    } finally {
      setLoading(false);
    }
  }, []);



  const signInAsAdmin = useCallback(() => {
    // Create a mock admin session
    const adminSession = {
      access_token: 'admin-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'admin-refresh-token',
      user: {
        id: 'admin-user-id',
        email: 'admin@speedtracker.app',
        role: 'admin',
        app_metadata: { provider: 'admin' },
        user_metadata: { name: 'Admin User' },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      },
    } as unknown as Session;

    setSession(adminSession);
    setUser(adminSession.user as User);
    setIsAdmin(true);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      logger.log('🚪 Starting sign out...');
      
      // If admin, just clear local state
      if (isAdmin) {
        logger.log('👤 Signing out admin user');
        setSession(null);
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
        logger.log('✅ Admin signed out successfully');
        return;
      }
      
      // Clear local state FIRST (immediate feedback)
      logger.log('🧹 Clearing local session and user state...');
      setSession(null);
      setUser(null);
      
      // Sign out from Supabase in background (don't wait for it)
      logger.log('🔐 Signing out from Supabase (background)...');
      supabase.auth.signOut().catch((error) => {
        logger.warn('⚠️ Supabase signOut error (non-blocking):', error);
      });
      
      logger.log('✅ Sign out successful');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      logger.error('❌ Sign out error:', msg);
      if (stack) logger.error('❌ Error stack:', stack);
      
      // Even if error occurs, clear local state
      logger.log('⚠️ Sign out error occurred, but clearing local state anyway...');
      setSession(null);
      setUser(null);
      
      // Show user-friendly error message
      if (error?.message?.includes('not supported')) {
        logger.error('OAuth provider not configured in Supabase');
      }
    } finally {
      setLoading(false);
      logger.log('🏁 Sign out process completed');
    }
  }, [isAdmin]);

  // Get current user identifier (either user ID or device ID)
  const getCurrentUserId = useCallback((): string | null => {
    if (user?.id) {
      return user.id;
    }
    return deviceId;
  }, [user?.id, deviceId]);

  // Update last seen for anonymous users
  const updateLastSeen = useCallback(async () => {
    if (isAnonymous && deviceId) {
      try {
        await supabase
          .from('anonymous_users')
          .update({ last_seen: new Date().toISOString() })
          .eq('device_id', deviceId);
      } catch (error) {
        // Silently fail if table doesn't exist
        logger.warn('Could not update last seen (table may not exist):', error);
      }
    }
  }, [isAnonymous, deviceId]);

  return useMemo(() => ({
    session,
    user,
    loading,
    isAuthenticated: !!session,
    isAdmin,
    isAnonymous,
    deviceId,
    getCurrentUserId,
    updateLastSeen,
    signInWithGoogle,
    signInWithApple,
    signInWithFacebook,
    signInAsAdmin,
    signOut,
  }), [
    session,
    user,
    loading,
    isAdmin,
    isAnonymous,
    deviceId,
    getCurrentUserId,
    updateLastSeen,
    signInWithGoogle,
    signInWithApple,
    signInWithFacebook,
    signInAsAdmin,
    signOut,
  ]);
});