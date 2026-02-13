-- ============================================
-- ПЪЛНА НАСТРОЙКА НА БАЗАТА ДАННИ
-- Изпълни този файл в Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. СЕКТОРИ (SECTORS)
-- ============================================
CREATE TABLE IF NOT EXISTS sectors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  route TEXT NOT NULL,
  speed_limit INTEGER NOT NULL,
  distance REAL NOT NULL,
  description TEXT,
  start_point_lat REAL NOT NULL,
  start_point_lng REAL NOT NULL,
  start_point_name TEXT NOT NULL,
  start_point_km REAL,
  end_point_lat REAL NOT NULL,
  end_point_lng REAL NOT NULL,
  end_point_name TEXT NOT NULL,
  end_point_km REAL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sectors_active ON sectors(active);
CREATE INDEX IF NOT EXISTS idx_sectors_route ON sectors(route);

ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to sectors" ON sectors;
CREATE POLICY "Allow public read access to sectors"
  ON sectors FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert access to sectors" ON sectors;
CREATE POLICY "Allow public insert access to sectors"
  ON sectors FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access to sectors" ON sectors;
CREATE POLICY "Allow public update access to sectors"
  ON sectors FOR UPDATE USING (true) WITH CHECK (true);

-- ============================================
-- 2. ПОТРЕБИТЕЛСКИ ПРОФИЛИ (USER PROFILES)
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  provider TEXT,
  provider_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_provider ON user_profiles(provider);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url, provider, provider_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.app_metadata->>'provider', 'email'),
    NEW.raw_user_meta_data->>'provider_id'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 3. ИСТОРИЯ НА НАРУШЕНИЯ (VIOLATIONS)
-- ============================================
CREATE TABLE IF NOT EXISTS violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT,
  sector_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE SET NULL,
  sector_name TEXT NOT NULL,
  speed_limit INTEGER NOT NULL,
  current_speed REAL NOT NULL,
  violation_type TEXT NOT NULL CHECK (violation_type IN ('speeding', 'normal')),
  location JSONB NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_violations_user_id ON violations(user_id);
CREATE INDEX IF NOT EXISTS idx_violations_device_id ON violations(device_id);
CREATE INDEX IF NOT EXISTS idx_violations_sector_id ON violations(sector_id);
CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON violations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_violations_violation_type ON violations(violation_type);

ALTER TABLE violations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own violations" ON violations;
CREATE POLICY "Users can view own violations"
  ON violations FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can insert own violations" ON violations;
CREATE POLICY "Users can insert own violations"
  ON violations FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Public can insert violations with device_id" ON violations;
CREATE POLICY "Public can insert violations with device_id"
  ON violations FOR INSERT WITH CHECK (device_id IS NOT NULL);

-- ============================================
-- 4. НАСТРОЙКИ НА ПОТРЕБИТЕЛИ (USER SETTINGS)
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notifications_enabled BOOLEAN DEFAULT true,
  vibration_enabled BOOLEAN DEFAULT true,
  sound_enabled BOOLEAN DEFAULT true,
  background_tracking_enabled BOOLEAN DEFAULT false,
  early_warning_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_settings_timestamp ON user_settings;
CREATE TRIGGER update_user_settings_timestamp
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();
