import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

const delay = ms => new Promise(res => setTimeout(res, ms));

async function run() {
  for (let i = 0; i < 5; i++) {
    try {
      const res = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name IN ('subscription_delivery_items', 'one_time_order_items') AND column_name = 'status';
      `);
      console.log("Status columns in item tables:", res.rows);
      break;
    } catch (err) {
      if (err.code === 'ENOTFOUND') {
        console.log("DNS failed, retrying...");
        await delay(2000);
        continue;
      }
      console.error(err);
      break;
    }
  }
  pool.end();
}
run();
