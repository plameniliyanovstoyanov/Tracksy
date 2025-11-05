/**
 * Script to seed sectors data into Supabase database
 * 
 * Usage:
 *   npx tsx database/seed-sectors.ts
 * 
 * Or with environment variables:
 *   SUPABASE_URL=your_url SUPABASE_SERVICE_KEY=your_key npx tsx database/seed-sectors.ts
 */

import { createClient } from '@supabase/supabase-js';
import { sectors } from '../data/sectors';

// Get Supabase credentials from environment or use defaults
const supabaseUrl = process.env.SUPABASE_URL || 'https://ztlyoketfstcsjylvfyq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0bHlva2V0ZnN0Y3NqeWx2ZnlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDI2OTAsImV4cCI6MjA3MzAxODY5MH0.hIpD_IyAxCHs2JLzUUIGL9wVwzZw-QRV2ca_ZEfyaLI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedSectors() {
  console.log('🌱 Starting to seed sectors into database...');
  console.log(`📊 Total sectors to insert: ${sectors.length}`);

  try {
    // Prepare data for insertion
    const sectorsData = sectors.map(sector => ({
      id: sector.id,
      name: sector.name,
      route: sector.route,
      speed_limit: sector.speedLimit,
      distance: sector.distance,
      description: sector.description,
      start_point_lat: sector.startPoint.lat,
      start_point_lng: sector.startPoint.lng,
      start_point_name: sector.startPoint.name,
      start_point_km: sector.startPoint.km ?? null,
      end_point_lat: sector.endPoint.lat,
      end_point_lng: sector.endPoint.lng,
      end_point_name: sector.endPoint.name,
      end_point_km: sector.endPoint.km ?? null,
      active: sector.active,
    }));

    // Insert sectors (upsert to handle duplicates)
    const { data, error } = await supabase
      .from('sectors')
      .upsert(sectorsData, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error('❌ Error seeding sectors:', error);
      throw error;
    }

    console.log(`✅ Successfully seeded ${data?.length || sectors.length} sectors into database`);
    console.log('🎉 Seeding completed!');
    
    return data;
  } catch (error) {
    console.error('❌ Failed to seed sectors:', error);
    throw error;
  }
}

// Run the seed function
if (require.main === module) {
  seedSectors()
    .then(() => {
      console.log('✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seed script failed:', error);
      process.exit(1);
    });
}

export { seedSectors };

