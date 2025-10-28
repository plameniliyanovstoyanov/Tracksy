import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import * as AuthSession from 'expo-auth-session';
import { ENV } from '../utils/env';

// Supabase project details from environment
const supabaseUrl = ENV.supabaseUrl || 'https://placeholder.supabase.co';
const supabaseAnonKey = ENV.supabaseAnonKey || 'placeholder-key';

if (!ENV.supabaseUrl || !ENV.supabaseAnonKey) {
  console.error('❌ CRITICAL: Supabase credentials are missing!');
  console.error('supabaseUrl:', ENV.supabaseUrl ? 'present' : 'MISSING');
  console.error('supabaseAnonKey:', ENV.supabaseAnonKey ? 'present' : 'MISSING');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper to get redirect URL for OAuth
export const getRedirectUrl = () => {
  const redirectTo = AuthSession.makeRedirectUri({
    native: 'myapp://redirect',
  });
  return redirectTo;
};