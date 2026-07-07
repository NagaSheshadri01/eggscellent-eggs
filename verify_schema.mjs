import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.tdnqhyzccuspszbnvjtz:' + encodeURIComponent('A01b02z26y25_SPB') + '@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('addresses', 'profiles');
    `);
    console.log("Tables found:", res.rows);

    const res2 = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'addresses' OR table_name = 'profiles';
    `);
    console.log("Columns:", res2.rows);
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
