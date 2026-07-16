import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res1 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'user_roles'");
    console.log("user_roles columns:", res1.rows.map(x=>x.column_name).join(", "));
    
    const res2 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'delivery_partners'");
    console.log("delivery_partners columns:", res2.rows.map(x=>x.column_name).join(", "));
  } catch (error) {
    console.error("ERROR:", error.message);
  } finally {
    pool.end();
  }
}
run();
