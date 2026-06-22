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
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('subscription_deliveries', 'one_time_orders', 'subscription_calendar_ledger', 'master_orders', 'delivery_ledger');
      `);
      console.log("Tables found:", res.rows.map(r => r.table_name));
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
