import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { supabase, getRedirectUrl } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';

import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
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

  return {
    session,
    user,
    loading,
    isAuthenticated: !!session,
    isAdmin,
    signInWithGoogle,
    signInWithApple,
    signInWithFacebook,
    signInAsAdmin,
    signOut,
  };
});