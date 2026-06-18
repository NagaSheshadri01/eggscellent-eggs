import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import path from 'path';

const password = encodeURIComponent('A01b02z26y25@spb');
const connectionString = `postgresql://postgres.tdnqhyzccuspszbnvjtz:${password}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`;

async function pushMigrations() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false } // Supabase pooler connection needs ssl
  });

  try {
    await client.connect();
    console.log("Connected to Supabase.");

    const migrations = [
      'supabase/migrations/20260617000000_admin_wallet_refunds.sql',
      'supabase/migrations/20260618000000_update_delivery_config_tiers.sql'
    ];

    for (const file of migrations) {
      console.log(`Executing ${file}...`);
      const sql = fs.readFileSync(path.resolve(file), 'utf8');
      await client.query(sql);
      console.log(`Successfully executed ${file}`);
    }

  } catch (err) {
    console.error("Migration failed:");
    console.error(err);
  } finally {
    await client.end();
  }
}

pushMigrations();
