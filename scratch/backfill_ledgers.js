import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT s.id, s.user_id, s.product_slug, s.quantity, s.selected_days, s.product_id
      FROM subscriptions s
      LEFT JOIN delivery_ledger dl ON s.id = dl.subscription_id
      WHERE s.status = 'active'
      GROUP BY s.id
      HAVING COUNT(dl.id) = 0;
    `);

    const subs = res.rows;
    console.log("Found subs needing backfill:", subs.length);

    for (const sub of subs) {
      const prodRes = await pool.query('SELECT discounted_price, original_price FROM products WHERE id = $1', [sub.product_id]);
      const prodData = prodRes.rows[0];
      
      let allowedDays = sub.selected_days || [];
      if (typeof allowedDays === 'string') {
        try { allowedDays = JSON.parse(allowedDays); } catch(e) {}
      }

      const price = prodData?.discounted_price ?? (prodData?.original_price ?? 0);
      const today = new Date();

      let insertedCount = 0;
      for (let i = 1; i <= 14; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const dayOfWeek = d.getDay();
        
        if (allowedDays.includes(dayOfWeek) || allowedDays.includes(String(dayOfWeek))) {
          await pool.query(`
            INSERT INTO public.delivery_ledger 
            (user_id, subscription_id, delivery_date, product_slug, quantity, effective_price, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT DO NOTHING;
          `, [sub.user_id, sub.id, dateStr, sub.product_slug, sub.quantity, price, 'pending']);
          insertedCount++;
        }
      }
      console.log(`Backfilled ${insertedCount} rows for sub ${sub.id}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
