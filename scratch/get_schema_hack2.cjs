const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL="(.*)"/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/);
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
  const res = await supabase.from('subscription_deliveries').select('dummy_column');
  console.log("Error fallback sub:", res.error);

  const res2 = await supabase.from('one_time_orders').select('dummy_column');
  console.log("Error fallback oto:", res2.error);
}
run();
