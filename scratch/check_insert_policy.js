import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const res = await pool.query(`
      SELECT polname, polcmd, pg_get_expr(polwithcheck, polrelid) as withcheck
      FROM pg_policy
      WHERE polrelid = 'public.delivery_ledger'::regclass AND polname = 'Users can insert their own calendar delivery entries';
    `);
    console.log("Insert Policy Check:", res.rows[0].withcheck);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
