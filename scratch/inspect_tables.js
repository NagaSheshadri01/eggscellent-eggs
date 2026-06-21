import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const res = await pool.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_name IN ('orders', 'master_orders');
    `);
    console.log("Tables info:", res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
