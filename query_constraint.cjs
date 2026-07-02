const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:A01b02z26y25_SPB@db.tdnqhyzccuspszbnvjtz.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'one_time_orders' AND c.conname = 'one_time_orders_status_check';
  `);
  console.log(res.rows);
  await client.end();
}

run().catch(console.error);
