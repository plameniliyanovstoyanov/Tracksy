import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, getRedirectUrl } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';

import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

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
        console.warn('Could not store device ID:', e);
      }
      
      return uniqueId;
    } catch (error) {
      console.error('Error generating device ID:', error);
      // Fallback to timestamp + random
      return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }, []);

  // Create anonymous user in database
  const createAnonymousUser = useCallback(async (deviceId: string) => {
    if (!deviceId?.trim()) {
      console.error('Invalid device ID provided');
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
        console.warn('Could not create anonymous user record (this is OK if table does not exist):', error.message);
        return { device_id: deviceId }; // Return minimal data
      }
      
      return data;
    } catch (error) {
      console.warn('Error in createAnonymousUser (continuing without database record):', error);
      return { device_id: deviceId }; // Return minimal data
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // First, try to get authenticated session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // User is authenticated
          setSession(session);
          setUser(session.user);
          setIsAnonymous(false);
        } else {
          // No authenticated user, create anonymous session
          const generatedDeviceId = await generateDeviceId();
          setDeviceId(generatedDeviceId);
          
          // Create anonymous user record in database
          await createAnonymousUser(generatedDeviceId);
          setIsAnonymous(true);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
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
        setSession(session);
        setUser(session.user);
        setIsAnonymous(false);
        setDeviceId(null);
      } else {
        setSession(null);
        setUser(null);
        // Switch back to anonymous mode
        const generatedDeviceId = await generateDeviceId();
        setDeviceId(generatedDeviceId);
        await createAnonymousUser(generatedDeviceId);
        setIsAnonymous(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const redirectTo = getRedirectUrl();
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: Platform.OS !== 'web',
        },
      });

      if (error) throw error;

      if (Platform.OS !== 'web' && data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo,
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
    } catch (error: any) {
      console.error('Authentication error:', error.message);
      // Show user-friendly error message
      if (error.message.includes('not supported')) {
        console.error('OAuth provider not configured in Supabase');
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithApple = async () => {
    try {
      setLoading(true);
      const redirectTo = getRedirectUrl();
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo,
          skipBrowserRedirect: Platform.OS !== 'web',
        },
      });

      if (error) throw error;

      if (Platform.OS !== 'web' && data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo,
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
    } catch (error: any) {
      console.error('Authentication error:', error.message);
      // Show user-friendly error message
      if (error.message.includes('not supported')) {
        console.error('OAuth provider not configured in Supabase');
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithFacebook = async () => {
    try {
      setLoading(true);
      const redirectTo = getRedirectUrl();
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo,
          skipBrowserRedirect: Platform.OS !== 'web',
        },
      });

      if (error) throw error;

      if (Platform.OS !== 'web' && data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo,
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
    } catch (error: any) {
      console.error('Authentication error:', error.message);
      // Show user-friendly error message
      if (error.message.includes('not supported')) {
        console.error('OAuth provider not configured in Supabase');
      }
    } finally {
      setLoading(false);
    }
  };



  const signInAsAdmin = () => {
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
    } as any;

    setSession(adminSession);
    setUser(adminSession.user);
    setIsAdmin(true);
    setLoading(false);
  };

  const signOut = async () => {
    try {
      setLoading(true);
      
      // If admin, just clear local state
      if (isAdmin) {
        setSession(null);
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null);
      setUser(null);
    } catch (error: any) {
      console.error('Authentication error:', error.message);
      // Show user-friendly error message
      if (error.message.includes('not supported')) {
        console.error('OAuth provider not configured in Supabase');
      }
    } finally {
      setLoading(false);
    }
  };

  // Get current user identifier (either user ID or device ID)
  const getCurrentUserId = (): string | null => {
    if (user?.id) {
      return user.id;
    }
    return deviceId;
  };

  // Update last seen for anonymous users
  const updateLastSeen = async () => {
    if (isAnonymous && deviceId) {
      try {
        await supabase
          .from('anonymous_users')
          .update({ last_seen: new Date().toISOString() })
          .eq('device_id', deviceId);
      } catch (error) {
        // Silently fail if table doesn't exist
        console.warn('Could not update last seen (table may not exist):', error);
      }
    }
  };

  return {
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
  };
});