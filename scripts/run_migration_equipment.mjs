import { createClient } from '@supabase/supabase-js';

const url = 'https://npmjrbppqqpcbebgcabj.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbWpyYnBwcXFwY2JlYmdjYWJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzg2NTAzOSwiZXhwIjoyMDg5NDQxMDM5fQ.36xdjlV_3rBUz3baFYbqw_jprz_Mp8-aeAMIB3XXl40';

const supabase = createClient(url, key);

// Equipment items seed data
const items = [
  // Fan & Draft System
  { no_item: '20 K-08.01 A/B', deskripsi: 'ID Fan' },
  { no_item: '20 K-08.02 AB/CD', deskripsi: 'FD Fan' },
  { no_item: '20 K-08.11 AB/CD', deskripsi: 'Seal Fan' },
  { no_item: '20 K-08.17 ABC/DEF', deskripsi: 'PAF' },
  // Oil System
  { no_item: '20 TK-08.03 A/B', deskripsi: 'Oil Thin Tank' },
  { no_item: '20 P-08.03 AB/CD', deskripsi: 'Oil Thin Pump' },
  // Solar System
  { no_item: '20 TK-08.04 A/B', deskripsi: 'Solar Tank' },
  { no_item: '20 P-08.04 A', deskripsi: 'Solar Pump Unloading' },
  { no_item: '20 P-08.04 B/C', deskripsi: 'Solar Pump' },
  { no_item: '20 B-08.05 ABCD', deskripsi: 'Gun Solar' },
  { no_item: '20 B-08.05 EFGH', deskripsi: 'Gun Solar' },
  // Coal Handling
  { no_item: '20 L-08.12 ABC/DEF', deskripsi: 'Coal Mill' },
  { no_item: '20 GB-08.12', deskripsi: 'Gear Box Coal Mill' },
  { no_item: '20 G-08.14 ABC/DEF', deskripsi: 'Coal Bunker' },
  { no_item: '20 M-08.15 ABC/DEF', deskripsi: 'Coal Feeder' },
  { no_item: '20 VF-08.16 ABC/DEF', deskripsi: 'Vibrating Coal Feeder' },
  // Turbine & Generator
  { no_item: '20 TG-01.01', deskripsi: 'Steam Turbine' },
  { no_item: '20 EG-01.02', deskripsi: 'Electric Generator' },
  { no_item: '20 TX-01.03', deskripsi: 'Eksitasi Device' },
  { no_item: '20 E-01.04', deskripsi: 'Condenser' },
  { no_item: '20 P-01.04 A/B', deskripsi: 'Pompa Condenser' },
  { no_item: '20 P-01.05 A/B', deskripsi: 'Turbin Driven Oil Pump / HPO' },
  { no_item: '20 TK-01.05', deskripsi: 'TK HPO Governor' },
  { no_item: '20 E-01.06/07', deskripsi: '1#/2# LP Heater' },
  { no_item: '20 EJ-01.08', deskripsi: 'Oil Injector' },
  { no_item: '20 K-01.08', deskripsi: 'Exhaust Fan' },
  { no_item: '20 TK-01.08', deskripsi: 'Oil Tank' },
  { no_item: '20 E-01.08', deskripsi: 'Oil Cooler' },
  { no_item: '20 P-01.08 A (AC)', deskripsi: 'Aux Oil Pump' },
  { no_item: '20 P-01.03 B (DC)', deskripsi: 'Aux. Oil Pump' },
  { no_item: '20 P-01.08 C', deskripsi: 'High Press. Oil Pump' },
  { no_item: '20 P-01.09', deskripsi: 'LPH-1 Drain Pump' },
  { no_item: '20 E-01.10/11', deskripsi: '1#/2# HP Heater' },
  { no_item: '20 E-01.12', deskripsi: 'Gland Seal HE' },
  { no_item: '20 TK-01.03 A/B', deskripsi: 'Drain Expansion Tank' },
  { no_item: '20 TK-01.14 A/B', deskripsi: 'Water Jet Tank' },
  { no_item: '20 P-01.14 A/B', deskripsi: 'Water Jet Pump' },
  { no_item: '20 WJE-01.14 A/B', deskripsi: 'Water Jet Air Ejector' },
  { no_item: '20 EB-01.15', deskripsi: 'Equalisation Box' },
  { no_item: '20 DHP-01.16', deskripsi: '1# Desuperheater Depresser' },
  { no_item: '20 DHP-01.17', deskripsi: '2# Desuperheater Depresser' },
  { no_item: '20 DA-01.18', deskripsi: 'HP Deaerator' },
  { no_item: '20 TK-01.18', deskripsi: 'Deaerator Tank' },
  { no_item: '20 H-01.19', deskripsi: 'Double Hook Bridge Crane' },
  { no_item: '20 E-01.20 A/B', deskripsi: 'Air Cooler' },
  // Boiler
  { no_item: '20 B-02.01 A/B', deskripsi: 'Steam Drum / Boiler' },
  { no_item: '20 SV-02.01 A/B', deskripsi: 'Safety Valve Boiler A' },
  { no_item: '20 SV-02.01 A/B', deskripsi: 'Safety Valve Boiler B' },
  { no_item: '20 E-02.01 A/B', deskripsi: 'Air Preheater A/B' },
  { no_item: '20 E-02.02 A/B', deskripsi: 'Lower Economizer' },
  { no_item: '20 E-02.03 A/B', deskripsi: 'Upper Economizer' },
  { no_item: '20 E-02.04 A/B', deskripsi: 'LT. Superheater' },
  { no_item: '20 E-02.05 A/B', deskripsi: '1st DSH A/B' },
  { no_item: '20 E-02.06 A/B', deskripsi: '1st HT. Superheater' },
  { no_item: '20 E-02.07 A/B', deskripsi: '2nd DSH A/B' },
  { no_item: '20 E-02.08 A/B', deskripsi: '2nd HT. Superheater' },
  { no_item: '20 TK-02.09', deskripsi: 'Amine Tank' },
  { no_item: '20 P-02.09 AB/CD', deskripsi: 'Amine Pump' },
  { no_item: '20 P-02.09 E/F', deskripsi: 'Amine Base Stirrier' },
  { no_item: '20 TK-02.10', deskripsi: 'Phosphate Tank' },
  { no_item: '20 P-02.10 AB/CD', deskripsi: 'Phosphate Pump' },
  { no_item: '20 P-02.10 E/F', deskripsi: 'Phosphate Stirrier' },
  { no_item: '20 TK-02.11', deskripsi: 'Hydrazine Tank' },
  { no_item: '20 P-02.11 AB/CD', deskripsi: 'Hydrazine Pump' },
  { no_item: '20 MP-02.11 E/F', deskripsi: 'Hydrazine Stirrier' },
  { no_item: '20 TK-02.12', deskripsi: 'Continues BD Tank' },
  { no_item: '20 TK-02.13', deskripsi: 'Periodic BD Tank' },
  { no_item: '20 TK-02.14', deskripsi: 'Drain Flash Tank' },
  { no_item: '20 TK-02.15 A/B', deskripsi: 'Drainage Tank' },
  { no_item: '20 MP.02.15 A/B', deskripsi: 'Drainage Pump' },
  { no_item: '20 MG-02.16', deskripsi: 'Silo Wall Vibrator' },
  { no_item: '20 MP-02.18 A/B/C', deskripsi: 'BFW Pump' },
  // ESP
  { no_item: '20 EP-03.03 A/B', deskripsi: 'ESP' },
  { no_item: '20 EP-03.04', deskripsi: 'Chimney' },
  // Bottom Ash
  { no_item: '20 M-04.02 A/B', deskripsi: 'Bottom Slug Conveyor' },
  // Ash Silo & Fly Ash
  { no_item: '20 G-05.01 A/B', deskripsi: 'Ash Silo' },
  { no_item: '20 DC-05.03 A/B/C', deskripsi: 'Dust Collector' },
  { no_item: '20 EFP-05.04', deskripsi: 'Electroda Fluidized Plate' },
  { no_item: '20 K-05.04 A/B', deskripsi: 'Bag Filter Silo' },
  { no_item: '20 E-05.10', deskripsi: 'Heater Ash Silo' },
  { no_item: '20 E-05.10 A/B/C', deskripsi: 'Air Dryer' },
  { no_item: '20 K-05.10 A/B/C', deskripsi: 'Compressor' },
  { no_item: '20 TK-05.10 A/B', deskripsi: 'Compressor Tank' },
  { no_item: '20 M-05.11 A/B/C/D', deskripsi: 'Vessel' },
  { no_item: '20 M-05.12 A/B/C/D', deskripsi: 'Vessel' },
  { no_item: '20 M-05.13 A/B/C/D', deskripsi: 'Vessel' },
  { no_item: '20 V-05.14 A/B/C/D', deskripsi: 'Crossover Valve' },
  { no_item: '20 V-05.16 A/B', deskripsi: 'Rotary Valve' },
  { no_item: '20 M-05.08 A/B', deskripsi: 'Two Shaft Mixer' },
  // Coal Conveyor
  { no_item: '20 G-07.03 A/B', deskripsi: 'Hopper A/B' },
  { no_item: '20 P-07.03 A/B', deskripsi: 'Bajul Pump' },
  { no_item: '20 M-07.03 A/B', deskripsi: 'Conveyor Point 3' },
  { no_item: '20 M-07.04 A/B', deskripsi: 'Conveyor Point 4' },
  { no_item: '20 SM-07.04 A/B', deskripsi: 'Magnet Separator' },
  { no_item: '20 T-07.04', deskripsi: 'TH 4' },
  { no_item: '20 M-07.05 A/B', deskripsi: 'Conveyor Point 5' },
  { no_item: '20 VS-07.05 AB/CD', deskripsi: 'Vibrating Screen AB/CD' },
  { no_item: '20 Q-07.05 A/B', deskripsi: 'Crusher' },
  { no_item: '20 DM-07.05 A/B', deskripsi: 'Metal Detector' },
  { no_item: '20 T-07.05', deskripsi: 'TH 5' },
  { no_item: '20 M-07.06 A/B', deskripsi: 'Conveyor Point 6' },
  { no_item: '20 SR-07.06', deskripsi: 'Stacker Reclaimer' },
  { no_item: '20 CS-07.06 A/B', deskripsi: 'Coal Sampling' },
  { no_item: '20 T-07.06', deskripsi: 'TH 6' },
  { no_item: '20 M-07.07 A/B', deskripsi: 'Conveyor Point 7' },
  { no_item: '20 PD-07.07 AB/CD/EF', deskripsi: 'Plowbelt' },
  // CW System
  { no_item: '20 P-09.01 A/B/C', deskripsi: 'CWP' },
  { no_item: '20 P-09.02 A/B/C', deskripsi: 'Industrial Pump' },
  { no_item: '20 P-09.03 A/B', deskripsi: 'Movable Sewage (WWT)' },
  { no_item: '20 K-09.05 ABCD', deskripsi: 'Cooling Fan' },
  { no_item: '20 TK-09.05 ABC', deskripsi: 'Metering Dosing Device' },
  { no_item: '20 P-09.05 ABC', deskripsi: 'Dosing Pump' },
  { no_item: '20 T-09.05', deskripsi: 'Basin' },
  // Service Water & Hydrant
  { no_item: '20 P-10.05 A/B', deskripsi: 'Service Water Pump' },
  { no_item: '20 TK-10.07', deskripsi: 'RCW' },
  { no_item: '20 P-10.01 A/B', deskripsi: 'Make Up Pump' },
  { no_item: '20 P-10.02 A/B', deskripsi: 'Jockey Pump' },
  { no_item: '20 P-10.03', deskripsi: 'Hydrant (Motor)' },
  { no_item: '20 P-10.04', deskripsi: 'Hydrant (Diesel)' },
];

async function run() {
  // First, try to create the table via SQL
  console.log('Creating table via SQL...');
  const sqlRes = await fetch('https://npmjrbppqqpcbebgcabj.supabase.co/sql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      query: `
        CREATE TABLE IF NOT EXISTS equipment_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          no_item TEXT NOT NULL,
          deskripsi TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_equipment_items_no_item ON equipment_items (no_item);
        CREATE INDEX IF NOT EXISTS idx_equipment_items_deskripsi ON equipment_items (deskripsi);
        ALTER TABLE equipment_items ENABLE ROW LEVEL SECURITY;
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'equipment_items' AND policyname = 'Allow all select on equipment_items') THEN
            CREATE POLICY "Allow all select on equipment_items" ON equipment_items FOR SELECT USING (true);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'equipment_items' AND policyname = 'Allow all insert on equipment_items') THEN
            CREATE POLICY "Allow all insert on equipment_items" ON equipment_items FOR INSERT WITH CHECK (true);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'equipment_items' AND policyname = 'Allow all update on equipment_items') THEN
            CREATE POLICY "Allow all update on equipment_items" ON equipment_items FOR UPDATE USING (true) WITH CHECK (true);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'equipment_items' AND policyname = 'Allow all delete on equipment_items') THEN
            CREATE POLICY "Allow all delete on equipment_items" ON equipment_items FOR DELETE USING (true);
          END IF;
        END $$;
      `
    }),
  });
  
  console.log('SQL status:', sqlRes.status);
  const sqlText = await sqlRes.text();
  console.log('SQL response:', sqlText.substring(0, 200));

  // Check if table exists now
  console.log('\nChecking if table exists...');
  const { data: existing, error: checkErr } = await supabase.from('equipment_items').select('id').limit(1);
  
  if (checkErr) {
    console.error('Table check failed:', checkErr.message);
    console.log('\n⚠️  Please run the migration SQL manually in Supabase SQL Editor:');
    console.log('   File: supabase/migration_equipment_items.sql');
    return;
  }

  console.log('Table exists! Current rows:', existing?.length || 0);

  // Check if data already seeded
  const { count } = await supabase.from('equipment_items').select('*', { count: 'exact', head: true });
  if (count && count > 0) {
    console.log(`Already has ${count} rows. Skipping seed.`);
    return;
  }

  // Insert seed data in batches of 50
  console.log(`\nInserting ${items.length} equipment items...`);
  const batchSize = 50;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const { error } = await supabase.from('equipment_items').insert(batch);
    if (error) {
      console.error(`Batch ${i}-${i + batch.length} error:`, error.message);
    } else {
      console.log(`  ✓ Inserted ${i + 1}-${i + batch.length}`);
    }
  }

  // Verify
  const { count: finalCount } = await supabase.from('equipment_items').select('*', { count: 'exact', head: true });
  console.log(`\n✅ Done! Total rows: ${finalCount}`);
}

run().catch(console.error);
