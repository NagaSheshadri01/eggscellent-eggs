const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.tdnqhyzccuspszbnvjtz:A01b02z26y25_SPB@aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    
    const tablesRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    
    const schema = {};
    for (let row of tablesRes.rows) {
      const table = row.table_name;
      
      const colsRes = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1", [table]);
      
      const fksRes = await client.query("SELECT kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1", [table]);
      
      schema[table] = {
        columns: colsRes.rows.map(c => ({ name: c.column_name, type: c.data_type })),
        foreignKeys: fksRes.rows
      };
    }
    
    fs.writeFileSync('../full_schema.json', JSON.stringify(schema, null, 2));
    console.log("Dumped full schema to full_schema.json");
    
  } catch(e) {
    console.error(e.message);
  } finally {
    await client.end();
  }
}
run();
