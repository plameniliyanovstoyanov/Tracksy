import Constants from 'expo-constants';

// Try multiple sources for environment variables
const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};

console.log('📦 Constants.expoConfig:', Constants.expoConfig);
console.log('📦 Constants.manifest:', Constants.manifest);
console.log('📦 extra:', extra);

export const ENV = {
  supabaseUrl: String(extra.SUPABASE_URL || ''),
  supabaseAnonKey: String(extra.SUPABASE_ANON_KEY || ''),
  mapboxToken: String(extra.MAPBOX_TOKEN || ''),
};

console.log('🔑 ENV.supabaseUrl:', ENV.supabaseUrl ? '✅ Found' : '❌ Missing');
console.log('🔑 ENV.supabaseAnonKey:', ENV.supabaseAnonKey ? '✅ Found' : '❌ Missing');
console.log('🔑 ENV.mapboxToken:', ENV.mapboxToken ? '✅ Found' : '❌ Missing');

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

