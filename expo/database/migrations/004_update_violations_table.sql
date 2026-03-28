-- Update violations table to link to user profiles
-- First, create violations table if it doesn't exist
CREATE TABLE IF NOT EXISTS violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT, -- Keep for backward compatibility with anonymous users
  sector_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE SET NULL,
  sector_name TEXT NOT NULL,
  speed_limit INTEGER NOT NULL,
  current_speed REAL NOT NULL,
  violation_type TEXT NOT NULL CHECK (violation_type IN ('speeding', 'normal')),
  location JSONB NOT NULL, -- {latitude: number, longitude: number}
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  duration INTEGER, -- Duration in seconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_violations_user_id ON violations(user_id);
CREATE INDEX IF NOT EXISTS idx_violations_device_id ON violations(device_id);
CREATE INDEX IF NOT EXISTS idx_violations_sector_id ON violations(sector_id);
CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON violations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_violations_violation_type ON violations(violation_type);

-- Enable Row Level Security
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own violations
CREATE POLICY "Users can view own violations"
  ON violations
  FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Policy: Users can insert their own violations
CREATE POLICY "Users can insert own violations"
  ON violations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policy: Public can insert violations (for anonymous users with device_id)
-- This allows anonymous users to save violations
CREATE POLICY "Public can insert violations with device_id"
  ON violations
  FOR INSERT
  WITH CHECK (device_id IS NOT NULL);

