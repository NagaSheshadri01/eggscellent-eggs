const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres:A01b02z26y25_SPB@db.tdnqhyzccuspszbnvjtz.supabase.co:5432/postgres",
  });
  
  try {
    await client.connect();
    
    const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'one_time_orders'");
    console.log("one_time_orders:");
    console.log(res.rows);

    const res2 = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'subscription_deliveries'");
    console.log("subscription_deliveries:");
    console.log(res2.rows);
    
  } catch(e) {
    console.error(e.message);
  } finally {
    await client.end();
  }
}
run();
