import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, getDeepLink } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import * as AuthSession from 'expo-auth-session';

import * as WebBrowser from 'expo-web-browser';

// Helper to add timeout to promises
const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => {
      console.warn(`Operation timed out after ${timeoutMs}ms, using fallback`);
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('Error in createAnonymousUser (continuing without database record):', errorMessage);
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
            console.error('Error creating anonymous user:', error instanceof Error ? error.message : String(error));
          });
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
        
        // Ensure user profile exists (in case trigger didn't fire)
        try {
          const { data: existingProfile, error: checkError } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('id', session.user.id)
            .single();
          
          if (checkError && checkError.code === 'PGRST116') {
            // Profile doesn't exist, create it manually
            console.log('Creating user profile manually...');
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
              console.error('Error creating user profile:', insertError);
            } else {
              console.log('User profile created successfully');
            }
          }
        } catch (error) {
          console.error('Error checking/creating user profile:', error);
        }
        
        // Ensure user settings exist with default values
        try {
          const { data: existingSettings, error: settingsCheckError } = await supabase
            .from('user_settings')
            .select('id')
            .eq('user_id', session.user.id)
            .single();
          
          if (settingsCheckError && settingsCheckError.code === 'PGRST116') {
            // Settings don't exist, create them with default values
            console.log('Creating user settings with default values...');
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
              console.error('Error creating user settings:', settingsInsertError);
            } else {
              console.log('User settings created successfully with default values');
            }
          }
        } catch (error) {
          console.error('Error checking/creating user settings:', error);
        }
      } else {
        setSession(null);
        setUser(null);
        // Switch back to anonymous mode
        const generatedDeviceId = await generateDeviceId();
        setDeviceId(generatedDeviceId);
        try {
          await createAnonymousUser(generatedDeviceId);
        } catch (error) {
          console.error('Error creating anonymous user on auth change:', error instanceof Error ? error.message : String(error));
        }
        setIsAnonymous(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [createAnonymousUser, generateDeviceId]);

  const signInWithGoogle = useCallback(async () => {
    try {
      setLoading(true);
      // Use deep link for redirect back to app
      // Supabase will redirect to this deep link after OAuth
      const deepLink = getDeepLink();
      
      console.log('🔗 Google OAuth deep link:', deepLink);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: deepLink, // Direct deep link - Supabase handles callback automatically
          skipBrowserRedirect: true, // We'll handle the redirect manually
        },
      });

      if (error) throw error;

      if (Platform.OS !== 'web' && data?.url) {
        console.log('🌐 Opening OAuth URL:', data.url);
        console.log('🔗 Expected deep link:', deepLink);
        
        try {
          const result = await WebBrowser.openAuthSessionAsync(
            data.url,
            deepLink, // Deep link for redirect back to app
            {
              showInRecents: true,
            }
          );

          console.log('📱 Auth session result type:', result.type);
          console.log('📱 Auth session result:', result);

        if (result.type === 'success' && 'url' in result && result.url) {
          console.log('✅ Auth success, URL:', result.url);
          
          // Check if URL is deep link or Supabase callback
          let tokensUrl = result.url;
          
          // Parse tokens from URL - could be in deep link or Supabase callback
          console.log('📱 Parsing tokens from URL:', tokensUrl);
          
          let params: URLSearchParams | null = null;
          let url: URL | null = null;
          
          try {
            url = new URL(tokensUrl);
          } catch (e) {
            // If URL parsing fails, try to extract from string
            console.log('⚠️ URL parsing failed, trying manual extraction...');
            const hashMatch = tokensUrl.match(/#([^?]*)/);
            const queryMatch = tokensUrl.match(/\?([^#]*)/);
            
            if (hashMatch) {
              params = new URLSearchParams(hashMatch[1]);
              console.log('📋 Tokens in hash (manual):', hashMatch[1]);
            } else if (queryMatch) {
              params = new URLSearchParams(queryMatch[1]);
              console.log('📋 Tokens in query (manual):', queryMatch[1]);
            } else {
              // Try to get everything after # or ?
              const fragment = tokensUrl.split('#')[1] || tokensUrl.split('?')[1] || tokensUrl;
              params = new URLSearchParams(fragment);
              console.log('📋 Tokens from fragment (manual):', fragment);
            }
          }
          
          // If we have a valid URL, try standard parsing
          if (!params && url) {
            if (url.hash && url.hash.length > 1) {
              const hash = url.hash.substring(1);
              params = new URLSearchParams(hash);
              console.log('📋 Tokens in hash:', hash);
            } else if (url.search && url.search.length > 1) {
              params = new URLSearchParams(url.search.substring(1));
              console.log('📋 Tokens in query:', url.search);
            } else {
              // Try to get from path or fragment
              const fragment = tokensUrl.split('#')[1] || tokensUrl.split('?')[1] || '';
              if (fragment) {
                params = new URLSearchParams(fragment);
                console.log('📋 Tokens from fragment:', fragment);
              }
            }
          }
          
          if (!params) {
            console.error('❌ Could not parse URL parameters');
            console.error('Full URL:', tokensUrl);
            return;
          }
          
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          const error_param = params.get('error');
          const error_description = params.get('error_description');

          if (error_param) {
            console.error('❌ OAuth error in callback:', error_param);
            console.error('   Description:', error_description);
            throw new Error(`OAuth error: ${error_param} - ${error_description}`);
          }

          if (access_token && refresh_token) {
            console.log('✅ Tokens found, setting session...');
            const { data: { session }, error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            
            if (error) {
              console.error('❌ Error setting session:', error);
              throw error;
            }
            
            setSession(session);
            setUser(session?.user ?? null);
            console.log('✅ Session set successfully!');
          } else {
            console.error('❌ No tokens found in callback URL');
            console.error('Full URL:', tokensUrl);
            console.error('Access token present:', !!access_token);
            console.error('Refresh token present:', !!refresh_token);
            console.error('All params:', Array.from(params.entries()));
          }
        } else if (result.type === 'cancel') {
          console.log('⚠️ User cancelled OAuth flow');
        } else if (result.type === 'dismiss') {
          console.log('⚠️ OAuth flow dismissed');
        } else {
          console.error('❌ Auth session failed:', result.type);
          console.error('Result:', result);
        }
        } catch (browserError: any) {
          console.error('❌ Browser error:', browserError.message);
          console.error('⚠️ This might be an SSL/certificate issue. Check:');
          console.error('  1. Phone date/time is correct');
          console.error('  2. Internet connection is working');
          console.error('  3. Try opening https://ztlyoketfstcsjylvfyq.supabase.co in phone browser');
        }
      }
    } catch (error: any) {
      console.error('Authentication error:', error.message);
      console.error('Error stack:', error.stack);
      // Show user-friendly error message
      if (error.message.includes('not supported')) {
        console.error('OAuth provider not configured in Supabase');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    try {
      setLoading(true);
      // Use deep link directly - Supabase will handle the callback
      const deepLink = getDeepLink();
      
      console.log('🔗 Apple OAuth deep link:', deepLink);
      
      console.log('🔍 Calling Supabase signInWithOAuth with:');
      console.log('   Provider: apple');
      console.log('   RedirectTo:', deepLink);
      console.log('   SkipBrowserRedirect: true');
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: deepLink, // Direct deep link - Supabase handles callback automatically
          scopes: 'name email',
          skipBrowserRedirect: true, // We'll handle the redirect manually
        },
      });

      if (error) {
        console.error('❌ Supabase signInWithOAuth error:', error);
        console.error('   Error message:', error.message);
        console.error('   Error status:', error.status);
        throw error;
      }
      
      console.log('✅ Supabase signInWithOAuth success');
      console.log('   Data URL:', data?.url);

      if (Platform.OS !== 'web' && data?.url) {
        console.log('🌐 Opening Apple OAuth URL:', data.url);
        console.log('🔗 Expected deep link:', deepLink);
        
        // Fix URL if it's malformed - this is a workaround for Supabase bug
        let urlToOpen = data.url;
        console.log('🔍 Original OAuth URL from Supabase:', urlToOpen);
        
        // Fix if missing protocol and/or domain prefix
        if (urlToOpen.startsWith('/oketfstcsjylvfyq') || urlToOpen.includes('/oketfstcsjylvfyq')) {
          console.warn('⚠️ FIXING URL: Missing protocol and domain prefix detected...');
          urlToOpen = urlToOpen.replace(/\/oketfstcsjylvfyq\.supabase\.co/g, 'https://ztlyoketfstcsjylvfyq.supabase.co');
          console.log('✅ Fixed URL:', urlToOpen);
        }
        
        // Fix if missing 'z' prefix
        if (urlToOpen.includes('tlyoketfstcsjylvfyq.supabase.co') && !urlToOpen.includes('ztlyoketfstcsjylvfyq.supabase.co')) {
          console.warn('⚠️ FIXING URL: Missing "z" detected, fixing automatically...');
          urlToOpen = urlToOpen.replace(/tlyoketfstcsjylvfyq\.supabase\.co/g, 'ztlyoketfstcsjylvfyq.supabase.co');
          console.log('✅ Fixed URL:', urlToOpen);
        }
        
        // Fix if old domain with 'i' is used
        if (urlToOpen.includes('ztlyoketftsciylvfq.supabase.co')) {
          console.warn('⚠️ FIXING URL: Old domain with "i" detected, fixing to "j"...');
          urlToOpen = urlToOpen.replace(/ztlyoketftsciylvfq\.supabase\.co/g, 'ztlyoketfstcsjylvfyq.supabase.co');
          console.log('✅ Fixed URL:', urlToOpen);
        }
        
        // Ensure URL has protocol
        if (!urlToOpen.startsWith('http://') && !urlToOpen.startsWith('https://')) {
          console.warn('⚠️ FIXING URL: Missing protocol, adding https://...');
          if (urlToOpen.startsWith('/')) {
            urlToOpen = 'https://ztlyoketfstcsjylvfyq.supabase.co' + urlToOpen;
          } else {
            urlToOpen = 'https://' + urlToOpen;
          }
          console.log('✅ Fixed URL:', urlToOpen);
        }
        
        // Validate URL before opening
        try {
          const testUrl = new URL(urlToOpen);
          console.log('✅ OAuth URL is valid');
          console.log('   Hostname:', testUrl.hostname);
          console.log('   Full URL:', testUrl.href);
          console.log('   Search params:', testUrl.search);
          
          // Check if URL contains the correct Supabase domain
          if (!testUrl.hostname.includes('ztlyoketfstcsjylvfyq.supabase.co') && !testUrl.hostname.includes('appleid.apple.com')) {
            console.error('❌ CRITICAL: OAuth URL hostname is incorrect!');
            console.error('   Expected: ztlyoketfstcsjylvfyq.supabase.co or appleid.apple.com');
            console.error('   Got:', testUrl.hostname);
            console.error('   Full URL:', testUrl.href);
            console.error('   ⚠️ This means Site URL in Supabase Dashboard is wrong!');
            console.error('   Fix: Supabase Dashboard → Authentication → URL Configuration → Site URL');
            console.error('   Should be: https://ztlyoketfstcsjylvfyq.supabase.co');
            
            // Check if it's missing the 'z'
            if (testUrl.hostname.includes('tlyoketfstcsjylvfyq.supabase.co')) {
              console.error('   ❌ PROBLEM FOUND: Missing "z" in URL!');
              console.error('   Current Site URL in Supabase is probably: https://tlyoketfstcsjylvfyq.supabase.co');
              console.error('   Should be: https://ztlyoketfstcsjylvfyq.supabase.co');
            }
          }
        } catch (urlError) {
          console.error('❌ Invalid OAuth URL:', urlToOpen);
          console.error('❌ URL Error:', urlError);
          throw new Error('Invalid OAuth URL received from Supabase');
        }
        
        // Try to open browser with better error handling
        console.log('🌐 Attempting to open browser with URL:', urlToOpen);
        console.log('🔗 Expected deep link callback:', deepLink);
        
        try {
          const result = await WebBrowser.openAuthSessionAsync(
            urlToOpen, // Use fixed URL instead of original
            deepLink, // Deep link for redirect back to app
            {
              showInRecents: true,
            }
          );
          
          console.log('✅ Browser opened successfully, result type:', result.type);

          console.log('📱 Apple Auth session result type:', result.type);
          console.log('📱 Apple Auth session result:', result);

        if (result.type === 'success' && 'url' in result && result.url) {
          console.log('✅ Apple Auth success, URL:', result.url);
          
          // Check if URL is deep link or Supabase callback
          let tokensUrl = result.url;
          
          // Check if URL contains error parameters
          if (tokensUrl.includes('error=') || tokensUrl.includes('error_code=')) {
            console.error('❌ OAuth error detected in callback URL');
            const url = new URL(tokensUrl);
            const error = url.searchParams.get('error') || url.hash.split('&').find(p => p.startsWith('error='))?.split('=')[1];
            const errorCode = url.searchParams.get('error_code') || url.hash.split('&').find(p => p.startsWith('error_code='))?.split('=')[1];
            const errorDesc = url.searchParams.get('error_description') || url.hash.split('&').find(p => p.startsWith('error_description='))?.split('=')[1];
            
            console.error('   Error:', error);
            console.error('   Error Code:', errorCode);
            console.error('   Error Description:', errorDesc ? decodeURIComponent(errorDesc) : 'N/A');
            
            if (errorCode === 'bad_oauth_callback' || errorDesc?.includes('state parameter missing')) {
              console.error('❌ CRITICAL: OAuth state parameter missing!');
              console.error('   This usually means:');
              console.error('   1. Apple Secret Key in Supabase is incorrect (should be JWT, not .p8 file)');
              console.error('   2. Key ID or Team ID in Supabase is wrong');
              console.error('   3. Service ID mismatch between Supabase and Apple Developer');
              console.error('   4. Redirect URL mismatch between Supabase and Apple Developer');
              console.error('   Fix: Supabase Dashboard → Authentication → Providers → Apple → Check all fields');
              console.error('   Required values:');
              console.error('     - Services ID: bg.tracksy.app.signin');
              console.error('     - Key ID: SA5LZMLW98');
              console.error('     - Team ID: 5RQ9CQARF6');
              console.error('     - Secret Key: JWT token (run: node generate-apple-jwt.js)');
            }
            
            if (errorDesc?.includes('Unable to exchange external code')) {
              console.error('❌ CRITICAL: Cannot exchange Apple code!');
              console.error('   This means Apple returned a code, but Supabase cannot verify it.');
              console.error('   Most likely causes:');
              console.error('   1. Apple Secret Key is wrong or expired (must be JWT, not .p8 file)');
              console.error('   2. Key ID mismatch (Supabase vs Apple Developer)');
              console.error('   3. Team ID mismatch (Supabase vs Apple Developer)');
              console.error('   4. Services ID mismatch (Supabase vs Apple Developer)');
              console.error('   Fix steps:');
              console.error('   1. Run: node generate-apple-jwt.js');
              console.error('   2. Copy the ENTIRE JWT token');
              console.error('   3. Paste it in Supabase → Authentication → Providers → Apple → Secret Key');
              console.error('   4. Verify Key ID: SA5LZMLW98');
              console.error('   5. Verify Team ID: 5RQ9CQARF6');
              console.error('   6. Verify Services ID: bg.tracksy.app.signin');
              console.error('   7. Save and wait 1-2 minutes for changes to propagate');
            }
            
            throw new Error(`OAuth error: ${error} (${errorCode})`);
          }
          
          // Parse tokens from URL - could be in deep link or Supabase callback
          console.log('📱 Parsing tokens from URL:', tokensUrl);
          
          let params: URLSearchParams | null = null;
          let url: URL | null = null;
          
          try {
            url = new URL(tokensUrl);
          } catch (e) {
            // If URL parsing fails, try to extract from string
            console.log('⚠️ URL parsing failed, trying manual extraction...');
            const hashMatch = tokensUrl.match(/#([^?]*)/);
            const queryMatch = tokensUrl.match(/\?([^#]*)/);
            
            if (hashMatch) {
              params = new URLSearchParams(hashMatch[1]);
              console.log('📋 Tokens in hash (manual):', hashMatch[1]);
            } else if (queryMatch) {
              params = new URLSearchParams(queryMatch[1]);
              console.log('📋 Tokens in query (manual):', queryMatch[1]);
            } else {
              // Try to get everything after # or ?
              const fragment = tokensUrl.split('#')[1] || tokensUrl.split('?')[1] || tokensUrl;
              params = new URLSearchParams(fragment);
              console.log('📋 Tokens from fragment (manual):', fragment);
            }
          }
          
          // If we have a valid URL, try standard parsing
          if (!params && url) {
            if (url.hash && url.hash.length > 1) {
              const hash = url.hash.substring(1);
              params = new URLSearchParams(hash);
              console.log('📋 Tokens in hash:', hash);
            } else if (url.search && url.search.length > 1) {
              params = new URLSearchParams(url.search.substring(1));
              console.log('📋 Tokens in query:', url.search);
            } else {
              // Try to get from path or fragment
              const fragment = tokensUrl.split('#')[1] || tokensUrl.split('?')[1] || '';
              if (fragment) {
                params = new URLSearchParams(fragment);
                console.log('📋 Tokens from fragment:', fragment);
              }
            }
          }
          
          if (!params) {
            console.error('❌ Could not parse URL parameters');
            console.error('Full URL:', tokensUrl);
            return;
          }
          
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          const error_param = params.get('error');
          const error_description = params.get('error_description');

          if (error_param) {
            console.error('❌ OAuth error in callback:', error_param);
            console.error('   Description:', error_description);
            throw new Error(`OAuth error: ${error_param} - ${error_description}`);
          }

          if (access_token && refresh_token) {
            console.log('✅ Tokens found, setting session...');
            const { data: { session }, error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            
            if (error) {
              console.error('❌ Error setting session:', error);
              throw error;
            }
            
            setSession(session);
            setUser(session?.user ?? null);
            console.log('✅ Session set successfully!');
          } else {
            console.error('❌ No tokens found in callback URL');
            console.error('Full URL:', tokensUrl);
            console.error('Access token present:', !!access_token);
            console.error('Refresh token present:', !!refresh_token);
            console.error('All params:', Array.from(params.entries()));
          }
        } else if (result.type === 'cancel') {
          console.log('⚠️ User cancelled Apple OAuth flow');
        } else if (result.type === 'dismiss') {
          console.log('⚠️ Apple OAuth flow dismissed');
        } else {
          console.error('❌ Apple Auth session failed:', result.type);
          console.error('Result:', result);
        }
        } catch (browserError: any) {
          console.error('❌ Browser error during OAuth:', browserError.message);
          console.error('❌ Browser error type:', browserError.name);
          console.error('❌ Browser error stack:', browserError.stack);
          console.error('⚠️ Failed to open OAuth URL in browser');
          console.error('   OAuth URL that failed:', urlToOpen);
          console.error('   Deep link expected:', deepLink);
          
          // Check for specific error types
          if (browserError.message?.includes('DNS') || browserError.message?.includes('NXDOMAIN')) {
            console.error('❌ DNS Error: Cannot resolve domain. Check internet connection.');
            console.error('   Solutions:');
            console.error('  1. Check internet connection on phone');
            console.error('  2. Try opening https://ztlyoketfstcsjylvfyq.supabase.co manually in phone browser');
            console.error('  3. Change DNS server on phone to 8.8.8.8 (Google DNS)');
            console.error('  4. Check if phone date/time is correct');
            console.error('  5. Try different network (WiFi vs mobile data)');
          } else if (browserError.message?.includes('NETWORK') || browserError.message?.includes('network')) {
            console.error('❌ Network Error: Cannot connect to server.');
            console.error('   Check internet connection and try again.');
          } else {
            console.error('❌ Unknown browser error. This might be an Android emulator issue.');
            console.error('   Try:');
            console.error('  1. Restart the emulator');
            console.error('  2. Check if Chrome is installed in the emulator');
            console.error('  3. Try on a real device instead of emulator');
          }
          
          // Don't throw - just log the error and let the user try again
          console.error('⚠️ OAuth flow failed, but user can try again');
        }
      }
    } catch (error: any) {
      console.error('Apple Authentication error:', error.message);
      console.error('Error stack:', error.stack);
      // Show user-friendly error message
      if (error.message.includes('not supported')) {
        console.error('OAuth provider not configured in Supabase');
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
    } catch (error: any) {
      console.error('Authentication error:', error.message);
      // Show user-friendly error message
      if (error.message.includes('not supported')) {
        console.error('OAuth provider not configured in Supabase');
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
    } as any;

    setSession(adminSession);
    setUser(adminSession.user);
    setIsAdmin(true);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🚪 Starting sign out...');
      
      // If admin, just clear local state
      if (isAdmin) {
        console.log('👤 Signing out admin user');
        setSession(null);
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
        console.log('✅ Admin signed out successfully');
        return;
      }
      
      // Sign out from Supabase
      console.log('🔐 Signing out from Supabase...');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ Supabase signOut error:', error);
        throw error;
      }
      
      // Clear local state
      console.log('🧹 Clearing local session and user state...');
      setSession(null);
      setUser(null);
      console.log('✅ Sign out successful');
    } catch (error: any) {
      console.error('❌ Sign out error:', error.message);
      console.error('❌ Error stack:', error.stack);
      
      // Even if Supabase signOut fails, clear local state
      console.log('⚠️ Supabase signOut failed, but clearing local state anyway...');
      setSession(null);
      setUser(null);
      
      // Show user-friendly error message
      if (error?.message?.includes('not supported')) {
        console.error('OAuth provider not configured in Supabase');
      }
    } finally {
      setLoading(false);
      console.log('🏁 Sign out process completed');
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
        console.warn('Could not update last seen (table may not exist):', error);
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