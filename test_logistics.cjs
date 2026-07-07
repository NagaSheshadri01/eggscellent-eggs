const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL="(.*)"/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/)[1].trim();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase
    .from("one_time_orders")
    .select(`
      *,
      profiles:user_id (id, full_name, phone, email),
      one_time_order_items (*),
      addresses:delivery_address_id (*)
    `)
    .in("status", ["pending", "confirmed", "out_for_delivery"]);

  if (error) {
    console.error('liveDispatchQ Error:', error.message);
  } else {
    console.log('liveDispatchQ Success:', data.length, 'records');
  }

  const { data: mData, error: mError } = await supabase
    .from("manifests")
    .select(`
      id, delivery_date, status, driver_id,
      manifest_drops (
        id, product_slug, quantity, status, user_id
      )
    `);

  if (mError) {
    console.error('morningManifestsQ Error:', mError.message);
  } else {
    console.log('morningManifestsQ Success:', mData.length, 'records');
  }
}
run();
