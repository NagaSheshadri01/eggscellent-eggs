const { Client } = require('pg');

async function testConn(connStr) {
  console.log('Testing:', connStr);
  const client = new Client({ connectionString: connStr, statement_timeout: 5000 });
  try {
    await client.connect();
    console.log('Connected successfully!');
    const res = await client.query('SELECT 1 as test');
    console.log('Query result:', res.rows);
    await client.end();
    return true;
  } catch(e) {
    console.log('Failed:', e.message);
    return false;
  }
}

async function run() {
  const pass = 'A01b02z26y25_SPB';
  const proj = 'tdnqhyzccuspszbnvjtz';
  const strings = [
    `postgresql://postgres.${proj}:${pass}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres:${pass}@db.${proj}.supabase.co:5432/postgres`,
    `postgresql://postgres.${proj}:${pass}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${proj}:${pass}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${proj}:${pass}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,
  ];
  for (const s of strings) {
    if (await testConn(s)) break;
  }
}
run();
