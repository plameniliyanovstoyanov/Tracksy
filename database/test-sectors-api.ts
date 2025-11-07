/**
 * Script to test if sectors are loaded correctly from the database via API
 * 
 * Usage:
 *   npx tsx database/test-sectors-api.ts
 */

import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment or use defaults
const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ztlyoketftsciylvfq.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0bHlva2V0ZnN0Y3NqeWx2ZnlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDI2OTAsImV4cCI6MjA3MzAxODY5MH0.hIpD_IyAxCHs2JLzUUIGL9wVwzZw-QRV2ca_ZEfyaLI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSectors() {
  console.log('🔍 Testing sectors in database...\n');

  try {
    // Test 1: Count total sectors
    console.log('1️⃣ Counting total sectors...');
    const { count, error: countError } = await supabase
      .from('sectors')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error counting sectors:', countError.message);
      console.log('\n💡 Tip: Make sure the sectors table exists. Run the SQL migration first!');
      return;
    }

    console.log(`   ✅ Total sectors in database: ${count || 0}\n`);

    if ((count || 0) === 0) {
      console.log('⚠️  No sectors found in database!');
      console.log('💡 Run: npm run seed:sectors\n');
      return;
    }

    // Test 2: Get active sectors
    console.log('2️⃣ Checking active sectors...');
    const { data: activeSectors, error: activeError } = await supabase
      .from('sectors')
      .select('id, name, route, speed_limit, active')
      .eq('active', true)
      .order('id')
      .limit(5);

    if (activeError) {
      console.error('❌ Error fetching active sectors:', activeError.message);
      return;
    }

    console.log(`   ✅ Active sectors: ${activeSectors?.length || 0}`);
    if (activeSectors && activeSectors.length > 0) {
      console.log('\n   First 5 active sectors:');
      activeSectors.forEach((sector, index) => {
        console.log(`   ${index + 1}. [${sector.id}] ${sector.name}`);
        console.log(`      Route: ${sector.route}, Speed limit: ${sector.speed_limit} km/h`);
      });
    }

    // Test 3: Get one full sector
    console.log('\n3️⃣ Getting full details of first sector...');
    const { data: firstSector, error: firstError } = await supabase
      .from('sectors')
      .select('*')
      .eq('id', '1')
      .single();

    if (firstError) {
      console.error('❌ Error fetching first sector:', firstError.message);
    } else if (firstSector) {
      console.log('   ✅ Sector #1 details:');
      console.log(`      ID: ${firstSector.id}`);
      console.log(`      Name: ${firstSector.name}`);
      console.log(`      Route: ${firstSector.route}`);
      console.log(`      Speed Limit: ${firstSector.speed_limit} km/h`);
      console.log(`      Distance: ${firstSector.distance} km`);
      console.log(`      Start: ${firstSector.start_point_name} (${firstSector.start_point_lat}, ${firstSector.start_point_lng})`);
      console.log(`      End: ${firstSector.end_point_name} (${firstSector.end_point_lat}, ${firstSector.end_point_lng})`);
      console.log(`      Active: ${firstSector.active}`);
    }

    // Test 4: Check if all required fields are present
    console.log('\n4️⃣ Validating data structure...');
    const { data: sampleSector, error: sampleError } = await supabase
      .from('sectors')
      .select('*')
      .limit(1)
      .single();

    if (!sampleError && sampleSector) {
      const requiredFields = [
        'id', 'name', 'route', 'speed_limit', 'distance',
        'start_point_lat', 'start_point_lng', 'start_point_name',
        'end_point_lat', 'end_point_lng', 'end_point_name', 'active'
      ];

      const missingFields = requiredFields.filter(field => !(field in sampleSector));
      
      if (missingFields.length === 0) {
        console.log('   ✅ All required fields are present');
      } else {
        console.log(`   ⚠️  Missing fields: ${missingFields.join(', ')}`);
      }
    }

    console.log('\n✨ Test completed successfully!');
    console.log(`\n📊 Summary: ${count || 0} sectors found in database`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testSectors()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test script failed:', error);
      process.exit(1);
    });
}

export { testSectors };

