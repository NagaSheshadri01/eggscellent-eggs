const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL="(.*)"/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/);
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
  const { data: subData, error: subErr } = await supabase
    .from("subscription_deliveries")
    .select('*, profiles:user_id (id, full_name, phone, email), subscription_delivery_items (*), addresses:delivery_address_id (*)')
    .limit(1);
  console.log("Sub Error:", subErr);

  const { data: retData, error: retErr } = await supabase
    .from("one_time_orders")
    .select('*, profiles:user_id (id, full_name, phone, email), one_time_order_items (*), addresses:delivery_address_id (*)')
    .limit(1);
  console.log("Retail Error:", retErr);
}
run();
