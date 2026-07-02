import fs from 'fs';
import pg from 'pg';
const { Client } = pg;

const regions = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3',
  'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
  'sa-east-1', 'ca-central-1'
];

async function run() {
  const sql = `
    SELECT pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'one_time_orders' AND c.conname = 'one_time_orders_status_check';
  `;
  
  for (const region of regions) {
    // using the exact password from .env: A01b02z26y25_SPB
    const connectionString = `postgresql://postgres.tdnqhyzccuspszbnvjtz:A01b02z26y25_SPB@aws-0-${region}.pooler.supabase.com:6543/postgres`;
    const client = new Client({ connectionString, connectionTimeoutMillis: 3000 });
    try {
      await client.connect();
      const res = await client.query(sql);
      console.log(`Success on region ${region}!`);
      console.log('CONSTRAINT DEFINITION:', res.rows[0]?.def);
      await client.end();
      return;
    } catch (err) {
      if (err.message.includes('tenant/user') || err.message.includes('not found') || err.code === 'ENOTFOUND') {
        // next region
      } else {
        console.error(`Region ${region} failed with different error:`, err.message);
      }
    }
  }
  console.log('Could not find the correct region or credentials are wrong.');
}

run();
