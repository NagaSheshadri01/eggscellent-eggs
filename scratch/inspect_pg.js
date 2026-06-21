import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const res = await pool.query(`
      SELECT table_name, view_definition 
      FROM information_schema.views 
      WHERE table_name = 'master_orders';
    `);
    console.log(res.rows[0]);
    
    const res2 = await pool.query(`
      SELECT id, delivery_partner_id, delivery_date FROM master_orders LIMIT 1;
    `);
    console.log(res2.rows);

  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
