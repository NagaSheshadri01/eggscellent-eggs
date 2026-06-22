import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function trace() {
  try {
    const subId = '487cf336-7434-41d7-81fc-9026c20055b5';
    const subRes = await pool.query('SELECT * FROM subscriptions WHERE id = $1', [subId]);
    const subData = subRes.rows[0];
    
    const prodRes = await pool.query('SELECT discounted_price, original_price FROM products WHERE id = $1', [subData.product_id]);
    const prodData = prodRes.rows[0];
    
    subData.products = prodData;

    let allowedDays = subData.selected_days || [];
    if (typeof allowedDays === 'string') {
      try { allowedDays = JSON.parse(allowedDays); } catch(e) {}
    }

    const price = subData.products?.discounted_price !== null && subData.products?.discounted_price !== undefined
      ? subData.products.discounted_price 
      : (subData.products?.original_price || 0);

    const today = new Date();
    console.log("Allowed days:", allowedDays);
    console.log("Price:", price);

    for (let i = 1; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const dayOfWeek = d.getDay();
      
      if (allowedDays.includes(dayOfWeek) || allowedDays.includes(String(dayOfWeek))) {
        console.log(`Trying to insert for ${dateStr} (day ${dayOfWeek})`);
        
        try {
          const res = await pool.query(`
            INSERT INTO public.delivery_ledger 
            (user_id, subscription_id, delivery_date, product_slug, quantity, effective_price, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id;
          `, [subData.user_id, subId, dateStr, subData.product_slug, subData.quantity, price, 'pending']);
          console.log(`Inserted:`, res.rows[0]);
        } catch(e) {
          console.error("Insert error:", e.message);
        }
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
trace();
