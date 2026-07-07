const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL="(.*)"/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/)[1].trim();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('manifests').select(`
    id, delivery_date, status, driver_id,
    manifest_drops (
      id, product_slug, quantity, status, user_id
    )
  `);
  if (error) console.error('Error:', error);
  else console.log('Successfully fetched manifests');
}
run();
