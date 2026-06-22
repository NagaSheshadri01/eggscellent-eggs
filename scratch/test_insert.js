import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    // get a user and a sub
    const subRes = await pool.query('SELECT * FROM subscriptions LIMIT 1');
    const sub = subRes.rows[0];
    if (!sub) return console.log('no subs');

    const res = await pool.query(`
      INSERT INTO public.delivery_ledger 
      (user_id, subscription_id, delivery_date, product_slug, quantity, effective_price, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `, [sub.user_id, sub.id, '2026-10-10', sub.product_slug, 1, 100, 'pending']);
    
    console.log("Success:", res.rows[0]);

    // cleanup
    await pool.query('DELETE FROM delivery_ledger WHERE id = $1', [res.rows[0].id]);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
