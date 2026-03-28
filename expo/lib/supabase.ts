import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import * as AuthSession from 'expo-auth-session';
import { ENV } from '../utils/env';
import { logger } from '../utils/logger';

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
      logger.error('❌ CRITICAL: Supabase credentials are missing!');
      logger.error('supabaseUrl:', supabaseUrl ? 'present' : 'MISSING');
      logger.error('supabaseAnonKey:', supabaseAnonKey ? 'present' : 'MISSING');
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

    logger.log('✅ Supabase client created successfully');
    return supabaseInstance;
  } catch (error) {
    logger.error('❌ Failed to create Supabase client:', error);
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
      logger.log('✅ Supabase client created with fallback values');
      return supabaseInstance;
    } catch (fallbackError) {
      logger.error('❌ Failed to create fallback Supabase client:', fallbackError);
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
        return (...args: unknown[]) => {
          try {
            return value.apply(client, args);
          } catch (error) {
            logger.error(`❌ Error calling supabase.${String(prop)}:`, error);
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
      logger.error(`❌ Error accessing supabase.${String(prop)}:`, error);
      // Return safe defaults
      if (typeof prop === 'string' && (prop.includes('query') || prop.includes('select'))) {
        return () => Promise.resolve({ data: null, error: null });
      }
      return null;
    }
  },
});

// Helper to get redirect URL for OAuth
export const getRedirectUrl = (deepLink?: string) => {
  // For mobile OAuth, we use Supabase callback URL
  // Supabase will handle the OAuth flow and redirect to our deep link
  const supabaseUrl = ENV.supabaseUrl || 'https://ztlyoketfstcsjylvfyq.supabase.co';
  
  // Validate Supabase URL
  if (!supabaseUrl.includes('ztlyoketfstcsjylvfyq.supabase.co')) {
    logger.error('❌ WARNING: Supabase URL might be incorrect!');
    logger.error('   Expected: ztlyoketfstcsjylvfyq.supabase.co');
    logger.error('   Got:', supabaseUrl);
    logger.error('   Please check Supabase Dashboard → Authentication → URL Configuration');
  }
  
  // Ensure URL has protocol
  const cleanUrl = supabaseUrl.startsWith('http') ? supabaseUrl : `https://${supabaseUrl}`;
  let redirectTo = `${cleanUrl}/auth/v1/callback`;
  
  // If deep link is provided, add it as query parameter
  // Supabase will redirect to this deep link after OAuth
  if (deepLink) {
    redirectTo += `?redirect_to=${encodeURIComponent(deepLink)}`;
  }
  
  // Debug log
  logger.log('🔗 Redirect URL (Supabase callback):', redirectTo);
  if (deepLink) {
    logger.log('ℹ️ Supabase will redirect to deep link after OAuth:', deepLink);
  }
  
  return redirectTo;
};

// Helper to get deep link for app redirect
export const getDeepLink = () => {
  // Use tracksy://auth/callback for OAuth redirects
  // This is production-ready and works in Expo Go, development builds, and production
  // The scheme "tracksy" is configured in app.config.js
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'tracksy',
    preferLocalhost: false,
  });
  
  // For OAuth, we want tracksy://auth/callback specifically
  // AuthSession.makeRedirectUri might return tracksy:// or tracksy://auth/callback
  // Let's ensure we use the correct path
  const deepLink = redirectUri.includes('auth/callback') 
    ? redirectUri 
    : 'tracksy://auth/callback';
  
  logger.log('🔗 Deep link (app redirect):', deepLink);
  logger.log('ℹ️ Using tracksy://auth/callback for OAuth (production-ready)');
  
  return deepLink;
};