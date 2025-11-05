-- Create sectors table
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

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sectors_active ON sectors(active);
CREATE INDEX IF NOT EXISTS idx_sectors_route ON sectors(route);

-- Enable Row Level Security (optional, depending on your needs)
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Allow public read access to sectors"
  ON sectors
  FOR SELECT
  USING (true);

