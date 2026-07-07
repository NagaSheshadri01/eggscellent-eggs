const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL="(.*)"/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/)[1].trim();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('one_time_orders').select('*').limit(1);
  if (error) console.error('Error fetching one_time_orders:', error);
  else console.log('Successfully fetched one_time_orders');

  const { data: d2, error: e2 } = await supabase.rpc('get_policies');
  if (e2) console.error('Error getting policies:', e2);
  else console.log('Policies:', d2);
}
run();
