-- Add is_premium column to user_profiles
-- Used by the subscription system to sync premium status from RevenueCat to Supabase
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;

-- Create index for premium status lookups (useful for analytics)
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_premium ON user_profiles(is_premium);
