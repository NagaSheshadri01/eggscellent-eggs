import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const res = await pool.query(`SELECT id FROM subscriptions ORDER BY created_at DESC LIMIT 1`);
    console.log("Latest sub ID:", res.rows[0].id);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
