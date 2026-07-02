import pg from 'pg';
const { Client } = pg;

async function run() {
  const sql = `
    SELECT pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'one_time_orders' AND c.conname = 'one_time_orders_status_check';
  `;
  
  const connectionString = 'postgresql://postgres:A01b02z26y25_SPB@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
  const client = new Client({ connectionString, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    const res = await client.query(sql);
    console.log('CONSTRAINT DEFINITION:', res.rows[0]?.def);
    await client.end();
  } catch (err) {
    console.error('Error connecting:', err);
  }
}

run();
