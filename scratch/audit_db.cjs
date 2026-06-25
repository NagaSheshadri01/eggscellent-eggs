const { execSync } = require('child_process');
const dbUrl = 'postgresql://postgres:A01b02z26y25_SPB@db.tdnqhyzccuspszbnvjtz.supabase.co:5432/postgres';

function runQuery(sql) {
  try {
    const command = `npx supabase db query "${sql}" --db-url "${dbUrl}"`;
    const res = execSync(command, { stdio: 'pipe' }).toString();
    return res;
  } catch(e) {
    return e.stdout?.toString() || e.message;
  }
}

console.log('--- ROUTINES ---');
console.log(runQuery(`
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND (routine_definition ILIKE '%orders%' 
       OR routine_definition ILIKE '%delivery_ledger%' 
       OR routine_definition ILIKE '%master_orders%'
       OR routine_definition ILIKE '%.product_slug%'
       OR routine_definition ILIKE '%s.product_slug%')
  AND routine_name NOT IN ('partner_update_order_status');
`));

console.log('--- POLICIES ---');
console.log(runQuery(`
SELECT tablename, policyname, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND (qual ILIKE '%orders%' OR qual ILIKE '%delivery_ledger%'
       OR with_check ILIKE '%orders%' OR with_check ILIKE '%delivery_ledger%');
`));

console.log('--- CONSTRAINTS ---');
console.log(runQuery(`
SELECT conname, pg_get_constraintdef(c.oid) 
FROM pg_constraint c 
JOIN pg_namespace n ON n.oid = c.connamespace 
WHERE contype = 'c' 
  AND (pg_get_constraintdef(c.oid) ILIKE '%orders%' OR pg_get_constraintdef(c.oid) ILIKE '%delivery_ledger%');
`));
