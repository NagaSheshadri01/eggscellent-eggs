import pg from 'pg';
const { Client } = pg;

const passwords = [
  'A01b02z26y25@spb',
  'A01b02z26y25_SPB',
  'A01b02z26y25_spb',
  'A01b02z26y25@SPB'
];

async function run() {
  for (const password of passwords) {
    const connectionString = `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent(password)}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`;
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
    try {
      console.log(`Trying password ${password}...`);
      await client.connect();
      console.log(`SUCCESS! Connected with password: ${password}`);
      const res = await client.query("SELECT 1");
      console.log("Query result:", res.rows);
      await client.end();
      return;
    } catch (err) {
      console.log(`Password ${password} failed: ${err.message}`);
    }
  }
}
run();
