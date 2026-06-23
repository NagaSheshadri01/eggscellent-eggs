const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://tdnqhyzccuspszbnvjtz.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'A01b02z26y25_SPB'; // Wait, I have to use the real anon key if it's there. 

// Better: read from .env
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
  const { data, error } = await supabase.from('one_time_orders').select('*').limit(1);
  console.log(error || Object.keys(data[0] || {}));
}
run();
