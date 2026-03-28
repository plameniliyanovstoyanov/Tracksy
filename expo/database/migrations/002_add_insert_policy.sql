-- Add INSERT policy for sectors table
-- This allows inserting data (needed for seed script)
CREATE POLICY "Allow public insert access to sectors"
  ON sectors
  FOR INSERT
  WITH CHECK (true);

-- Also add UPDATE policy in case we need to update sectors
CREATE POLICY "Allow public update access to sectors"
  ON sectors
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

