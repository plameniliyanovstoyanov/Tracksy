import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import * as AuthSession from 'expo-auth-session';
import { ENV } from '../utils/env';

// Lazy initialization to prevent crashes on app start
let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  try {
    const supabaseUrl = ENV.supabaseUrl || 'https://placeholder.supabase.co';
    const supabaseAnonKey = ENV.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MDAsImV4cCI6MTk2MDc2ODgwMH0.placeholder';

    if (!ENV.supabaseUrl || !ENV.supabaseAnonKey) {
      console.error('❌ CRITICAL: Supabase credentials are missing!');
      console.error('supabaseUrl:', ENV.supabaseUrl ? 'present' : 'MISSING');
      console.error('supabaseAnonKey:', ENV.supabaseAnonKey ? 'present' : 'MISSING');
      // Return a dummy client that won't crash but also won't work
    }

    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

    console.log('✅ Supabase client created successfully');
    return supabaseInstance;
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error);
    // Return a minimal mock client to prevent crashes
    throw new Error(`Failed to initialize Supabase: ${error}`);
  }
}

// Export as a Proxy to lazy-load the client
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    const client = getSupabaseClient();
    return client[prop as keyof SupabaseClient];
  },
});

// Helper to get redirect URL for OAuth
export const getRedirectUrl = () => {
  const redirectTo = AuthSession.makeRedirectUri({
    native: 'myapp://redirect',
  });
  return redirectTo;
};