const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL="(.*)"/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/)[1].trim();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function run() {
  const sql = `SELECT 1 as result;`;
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error('exec_sql error:', error.message);
  } else {
    console.log('exec_sql result:', data);
  }
}
run();
