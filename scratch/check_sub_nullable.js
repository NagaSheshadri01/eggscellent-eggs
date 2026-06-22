import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const res = await pool.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'delivery_ledger' AND column_name = 'subscription_id';
    `);
    console.log("subscription_id nullable:", res.rows[0].is_nullable);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
