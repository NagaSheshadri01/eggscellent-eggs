const { Client } = require('pg');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [k, v] = line.split('=');
  if(k && v) acc[k.trim()] = v.trim().replace(/^['"]|['"]$/g, '');
  return acc;
}, {});

const client = new Client({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();

  // 1. Column type of delivery_slot_key
  const colRes = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'one_time_orders' AND column_name = 'delivery_slot_key';
  `);
  console.log("=== COLUMN TYPE ===");
  console.log(colRes.rows);

  // 2. Foreign key
  const fkRes = await client.query(`
    SELECT
      tc.table_name, 
      kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM 
      information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'one_time_orders' AND tc.constraint_name = 'one_time_orders_delivery_slot_key_fkey';
  `);
  console.log("\n=== FOREIGN KEY ===");
  console.log(fkRes.rows);

  // 3. Triggers
  const trigRes = await client.query(`
    SELECT 
      trigger_name, event_manipulation, event_object_table, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'one_time_orders';
  `);
  console.log("\n=== TRIGGERS ===");
  console.log(trigRes.rows);

  // 4. Trigger functions if the action statement is EXECUTE FUNCTION
  for (const row of trigRes.rows) {
    const match = row.action_statement.match(/EXECUTE FUNCTION (.*?)\(/);
    if (match) {
      const funcName = match[1];
      const funcRes = await client.query(`
        SELECT pg_get_functiondef(p.oid) as def
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.proname = $1
      `, [funcName.replace(/\"/g, '').split('.').pop()]);
      console.log(`\n=== FUNCTION ${funcName} ===`);
      console.log(funcRes.rows[0]?.def);
    }
  }

  await client.end();
}

run().catch(console.error);
