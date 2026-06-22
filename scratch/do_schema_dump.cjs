const { Client } = require('pg');
const { getStructureSQL } = require('pg-schema-dump');
const fs = require('fs');

async function run() {
  const client = new Client({
    connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected. Generating SQL...");
    const sql = await getStructureSQL(client);
    fs.writeFileSync('schema_backup.sql', sql);
    console.log("Successfully wrote schema_backup.sql");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}
run();
