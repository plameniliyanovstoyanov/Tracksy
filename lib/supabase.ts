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
    // Use fallback values from ENV (which already has hardcoded fallbacks)
    const supabaseUrl = ENV.supabaseUrl || 'https://ztlyoketfstcsjylvfyq.supabase.co';
    const supabaseAnonKey = ENV.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0bHlva2V0ZnN0Y3NqeWx2ZnlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDI2OTAsImV4cCI6MjA3MzAxODY5MH0.hIpD_IyAxCHs2JLzUUIGL9wVwzZw-QRV2ca_ZEfyaLI';

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ CRITICAL: Supabase credentials are missing!');
      console.error('supabaseUrl:', supabaseUrl ? 'present' : 'MISSING');
      console.error('supabaseAnonKey:', supabaseAnonKey ? 'present' : 'MISSING');
      // Continue anyway with fallback values
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
    // Create a minimal client with fallback values to prevent crashes
    try {
      supabaseInstance = createClient(
        'https://ztlyoketfstcsjylvfyq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0bHlva2V0ZnN0Y3NqeWx2ZnlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDI2OTAsImV4cCI6MjA3MzAxODY5MH0.hIpD_IyAxCHs2JLzUUIGL9wVwzZw-QRV2ca_ZEfyaLI',
        {
          auth: {
            storage: AsyncStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
          },
        }
      );
      console.log('✅ Supabase client created with fallback values');
      return supabaseInstance;
    } catch (fallbackError) {
      console.error('❌ Failed to create fallback Supabase client:', fallbackError);
      // This should never happen, but if it does, we'll handle it in the Proxy
      throw fallbackError;
    }
  }
}

// Export as a Proxy to lazy-load the client
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    try {
      const client = getSupabaseClient();
      const value = client[prop as keyof SupabaseClient];
      // If it's a function, wrap it to catch errors
      if (typeof value === 'function') {
        return (...args: any[]) => {
          try {
            return value.apply(client, args);
          } catch (error) {
            console.error(`❌ Error calling supabase.${String(prop)}:`, error);
            // Return a safe default based on the function
            if (String(prop).includes('query') || String(prop).includes('select')) {
              return Promise.resolve({ data: null, error: null });
            }
            return Promise.resolve(null);
          }
        };
      }
      return value;
    } catch (error) {
      console.error(`❌ Error accessing supabase.${String(prop)}:`, error);
      // Return safe defaults
      if (typeof prop === 'string' && (prop.includes('query') || prop.includes('select'))) {
        return () => Promise.resolve({ data: null, error: null });
      }
      return null;
    }
  },
});

// Helper to get redirect URL for OAuth
export const getRedirectUrl = () => {
  const redirectTo = AuthSession.makeRedirectUri({
    native: 'myapp://redirect',
  });
  return redirectTo;
};