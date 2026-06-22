import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: `postgresql://postgres:${encodeURIComponent('A01b02z26y25_SPB')}@db.tdnqhyzccuspszbnvjtz.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('subscription_deliveries', 'one_time_orders', 'subscription_calendar_ledger', 'master_orders', 'delivery_ledger');
    `);
    console.log("Tables found:", res.rows.map(r => r.table_name));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
