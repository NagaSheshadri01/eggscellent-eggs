import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const res = await pool.query(`
      SELECT polname, polcmd, polroles
      FROM pg_policy
      WHERE polrelid = 'public.delivery_ledger'::regclass;
    `);
    console.log("Policies:", res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
