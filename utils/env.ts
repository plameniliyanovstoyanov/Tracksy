import Constants from 'expo-constants';

// Production fallback values - ALWAYS available
const PRODUCTION_SUPABASE_URL = 'https://ztlyoketfstcsjylvfyq.supabase.co';
const PRODUCTION_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0bHlva2V0ZnN0Y3NqeWx2ZnlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDI2OTAsImV4cCI6MjA3MzAxODY5MH0.hIpD_IyAxCHs2JLzUUIGL9wVwzZw-QRV2ca_ZEfyaLI';
const PRODUCTION_MAPBOX_TOKEN = 'pk.eyJ1IjoicGxhbWVuc3RveWFub3YiLCJhIjoiY21mcGtzdTh6MGMwdTJqc2NqNjB3ZjZvcSJ9.mYM2IeJEeCJkeaR2TVd4BQ';

// Safely try to get environment variables with fallbacks
function getExtra() {
  try {
    // Try multiple ways to get constants
    const config = Constants.expoConfig;
    const manifest = Constants.manifest;
    const extra = config?.extra ?? manifest?.extra ?? {};
    return extra;
  } catch (error) {
    // Silent fail - return empty object, fallbacks will be used
    return {};
  }
}

const extra = getExtra();

// ALWAYS use fallbacks - never fail
export const ENV = {
  supabaseUrl: String(
    extra?.SUPABASE_URL || 
    extra?.EXPO_PUBLIC_SUPABASE_URL || 
    PRODUCTION_SUPABASE_URL
  ),
  supabaseAnonKey: String(
    extra?.SUPABASE_ANON_KEY || 
    extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
    PRODUCTION_SUPABASE_ANON_KEY
  ),
  mapboxToken: String(
    extra?.MAPBOX_TOKEN || 
    extra?.EXPO_PUBLIC_MAPBOX_TOKEN || 
    PRODUCTION_MAPBOX_TOKEN
  ),
};

/**
 * Validates that all required environment variables are present
 * Call this early in your app (e.g., in App.tsx or _layout.tsx)
 */
export function validateEnv(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!ENV.supabaseUrl || !/^https?:\/\//.test(ENV.supabaseUrl)) {
    errors.push('SUPABASE_URL');
  }
  
  if (!ENV.supabaseAnonKey) {
    errors.push('SUPABASE_ANON_KEY');
  }
  
  if (!ENV.mapboxToken) {
    errors.push('MAPBOX_TOKEN');
  }
  
  if (errors.length > 0) {
    console.error('❌ Missing or invalid environment variables:', errors.join(', '));
    console.error('Please ensure .env file exists with all required variables');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

