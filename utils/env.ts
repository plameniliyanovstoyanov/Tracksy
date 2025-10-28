import Constants from 'expo-constants';

// Safely try to get environment variables with fallbacks
function getExtra() {
  try {
    return Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};
  } catch (error) {
    console.error('❌ Failed to read Constants:', error);
    return {};
  }
}

const extra = getExtra();

console.log('📦 Constants available:', Constants ? '✅' : '❌');
console.log('📦 extra keys:', Object.keys(extra));

export const ENV = {
  supabaseUrl: String(extra.SUPABASE_URL || extra.EXPO_PUBLIC_SUPABASE_URL || ''),
  supabaseAnonKey: String(extra.SUPABASE_ANON_KEY || extra.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''),
  mapboxToken: String(extra.MAPBOX_TOKEN || extra.EXPO_PUBLIC_MAPBOX_TOKEN || ''),
};

console.log('🔑 ENV.supabaseUrl:', ENV.supabaseUrl ? `✅ Found (${ENV.supabaseUrl.substring(0, 20)}...)` : '❌ Missing');
console.log('🔑 ENV.supabaseAnonKey:', ENV.supabaseAnonKey ? `✅ Found (${ENV.supabaseAnonKey.substring(0, 20)}...)` : '❌ Missing');
console.log('🔑 ENV.mapboxToken:', ENV.mapboxToken ? `✅ Found (${ENV.mapboxToken.substring(0, 20)}...)` : '❌ Missing');

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

