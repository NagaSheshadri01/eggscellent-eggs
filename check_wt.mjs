import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'wallet_transactions';
  `);
  console.log(res.rows);
  pool.end();
}
run();
