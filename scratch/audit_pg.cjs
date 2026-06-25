const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:A01b02z26y25_SPB@db.tdnqhyzccuspszbnvjtz.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();

  console.log('=== ROUTINES ===');
  const rRes = await client.query(`
    SELECT routine_name, routine_definition 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
      AND (routine_definition ILIKE '%orders%' 
           OR routine_definition ILIKE '%delivery_ledger%' 
           OR routine_definition ILIKE '%master_orders%'
           OR routine_definition ILIKE '%.product_slug%'
           OR routine_definition ILIKE '%s.product_slug%')
      AND routine_name NOT IN ('partner_update_order_status', 'check_wallet_low_balance_trigger');
  `);
  rRes.rows.forEach(r => console.log(`Routine: ${r.routine_name}\nDef: ${r.routine_definition.substring(0, 300)}...`));

  console.log('=== POLICIES ===');
  const pRes = await client.query(`
    SELECT tablename, policyname, qual, with_check 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND (qual ILIKE '%orders%' OR qual ILIKE '%delivery_ledger%'
           OR with_check ILIKE '%orders%' OR with_check ILIKE '%delivery_ledger%');
  `);
  pRes.rows.forEach(r => console.log(`Policy: ${r.tablename}.${r.policyname}\nQual: ${r.qual}\nWithCheck: ${r.with_check}`));

  console.log('=== CONSTRAINTS ===');
  const cRes = await client.query(`
    SELECT conname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c 
    JOIN pg_namespace n ON n.oid = c.connamespace 
    WHERE contype = 'c' 
      AND (pg_get_constraintdef(c.oid) ILIKE '%orders%' OR pg_get_constraintdef(c.oid) ILIKE '%delivery_ledger%');
  `);
  cRes.rows.forEach(r => console.log(`Constraint: ${r.conname}\nDef: ${r.def}`));

  await client.end();
}

run().catch(console.error);
