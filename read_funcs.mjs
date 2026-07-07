import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.tdnqhyzccuspszbnvjtz:' + encodeURIComponent('A01b02z26y25_SPB') + '@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query("SELECT proname, prosrc FROM pg_proc WHERE proname IN ('partner_update_order_status', 'check_wallet_low_balance_trigger');");
    res.rows.forEach(r => {
      console.log("--- Function: " + r.proname + " ---");
      console.log(r.prosrc);
    });
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
