import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'subscriptions';
    `);
    console.log(res.rows);
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();