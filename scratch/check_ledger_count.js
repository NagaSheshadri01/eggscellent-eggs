import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const res = await pool.query(`SELECT COUNT(*) FROM delivery_ledger WHERE subscription_id = '487cf336-7434-41d7-81fc-9026c20055b5'`);
    console.log("Count:", res.rows[0].count);
    
    const subRes = await pool.query(`SELECT selected_days FROM subscriptions WHERE id = '487cf336-7434-41d7-81fc-9026c20055b5'`);
    console.log("Selected days:", subRes.rows[0].selected_days);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
