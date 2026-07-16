import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query("SELECT pg_get_triggerdef(t.oid) FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid WHERE c.relname = 'profiles'");
    console.log(res.rows);
  } catch (error) {
    console.error("ERROR:", error.message);
  } finally {
    pool.end();
  }
}
run();
