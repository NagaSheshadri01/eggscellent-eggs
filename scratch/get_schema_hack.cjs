const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL="(.*)"/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/);
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
  const { data, error } = await supabase.rpc('get_columns_for_table', { table_name: 'one_time_orders' });
  if (error) {
    console.error(error);
    // fallback, try an invalid select to see the error message which might contain valid columns
    const res = await supabase.from('one_time_orders').select('dummy_column');
    console.log("Error fallback:", res.error);
  } else {
    console.log(data);
  }
}
run();
