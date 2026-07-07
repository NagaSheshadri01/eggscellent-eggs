import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res1 = await pool.query(`
      SELECT proname, prosrc 
      FROM pg_proc 
      WHERE prosrc ILIKE '%subscription_deliveries%' 
         OR prosrc ILIKE '%subscription_items%'
         OR proname ILIKE '%subscription_deliveries%'
         OR proname ILIKE '%subscription_items%';
    `);
    console.log("Functions referencing old tables:", res1.rows.map(r => r.proname));

    const res2 = await pool.query(`
      SELECT viewname, definition 
      FROM pg_views 
      WHERE schemaname = 'public' 
        AND (definition ILIKE '%subscription_deliveries%' OR definition ILIKE '%subscription_items%');
    `);
    console.log("Views referencing old tables:", res2.rows.map(r => r.viewname));

    const res3 = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'subscriptions';
    `);
    console.log("Subscriptions columns:", res3.rows.map(r => r.column_name));
    
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
