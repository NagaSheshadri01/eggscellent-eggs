import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    console.log("Restoring full constraint...");
    await pool.query(`
      ALTER TABLE public.delivery_ledger 
      DROP CONSTRAINT IF EXISTS check_delivery_ledger_status;

      ALTER TABLE public.delivery_ledger
      ADD CONSTRAINT check_delivery_ledger_status 
      CHECK (status IN ('pending', 'confirmed', 'out_for_delivery', 'delivered', 'out_of_stock', 'on_hold', 'scheduled', 'failed', 'skipped', 'cancelled', 'paused', 'pending_payment'));
    `);
    console.log("Success");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
