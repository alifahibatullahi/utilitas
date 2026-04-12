import { createClient } from '@supabase/supabase-js';

const url = 'https://npmjrbppqqpcbebgcabj.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbWpyYnBwcXFwY2JlYmdjYWJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzg2NTAzOSwiZXhwIjoyMDg5NDQxMDM5fQ.36xdjlV_3rBUz3baFYbqw_jprz_Mp8-aeAMIB3XXl40';

const supabase = createClient(url, key);

async function run() {
  console.log('Adding stock chemical columns via SQL...');
  const sqlRes = await fetch('https://npmjrbppqqpcbebgcabj.supabase.co/sql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      query: `
        ALTER TABLE shift_water_quality ADD COLUMN IF NOT EXISTS stock_phosphate NUMERIC;
        ALTER TABLE shift_water_quality ADD COLUMN IF NOT EXISTS stock_amine NUMERIC;
        ALTER TABLE shift_water_quality ADD COLUMN IF NOT EXISTS stock_hydrazine NUMERIC;
      `
    }),
  });
  
  console.log('SQL status:', sqlRes.status);
  const sqlText = await sqlRes.text();
  console.log('SQL response:', sqlText.substring(0, 200));
}

run().catch(console.error);
