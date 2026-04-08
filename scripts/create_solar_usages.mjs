import { createClient } from '@supabase/supabase-js';

const url = 'https://npmjrbppqqpcbebgcabj.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbWpyYnBwcXFwY2JlYmdjYWJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzg2NTAzOSwiZXhwIjoyMDg5NDQxMDM5fQ.36xdjlV_3rBUz3baFYbqw_jprz_Mp8-aeAMIB3XXl40';

const supabase = createClient(url, key);

async function run() {
  console.log('Creating table via SQL...');
  const sqlRes = await fetch('https://npmjrbppqqpcbebgcabj.supabase.co/sql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      query: `
        CREATE TABLE IF NOT EXISTS solar_usages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          date TEXT NOT NULL,
          shift TEXT,
          liters NUMERIC NOT NULL,
          tujuan TEXT NOT NULL,
          operator_id UUID,
          created_at TIMESTAMPTZ DEFAULT now()
        );
        ALTER TABLE solar_usages ENABLE ROW LEVEL SECURITY;
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'solar_usages' AND policyname = 'Allow all actions on solar_usages') THEN
            CREATE POLICY "Allow all actions on solar_usages" ON solar_usages FOR ALL USING (true) WITH CHECK (true);
          END IF;
        END $$;
        
        -- Also add shift column to solar_unloadings if not exists
        ALTER TABLE solar_unloadings ADD COLUMN IF NOT EXISTS shift TEXT;
      `
    }),
  });
  
  console.log('SQL status:', sqlRes.status);
  const sqlText = await sqlRes.text();
  console.log('SQL response:', sqlText.substring(0, 200));
}

run().catch(console.error);
