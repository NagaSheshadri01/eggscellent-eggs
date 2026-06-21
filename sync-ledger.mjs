import pg from 'pg';
const { Client } = pg;

const connectionString = `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`;

async function run() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
  
  try {
    await client.connect();
    console.log("Connected to PostgreSQL database!");
    
    console.log("Fetching active subscriptions...");
    const { rows: subscriptions } = await client.query(`
      SELECT s.id, s.user_id, s.product_slug, s.quantity, s.selected_days, p.discounted_price, p.original_price
      FROM public.subscriptions s
      LEFT JOIN public.products p ON p.slug = s.product_slug
      WHERE s.status = 'active'
    `);
    
    console.log(`Found ${subscriptions.length} active subscriptions.`);
    
    let rowsInserted = 0;
    const today = new Date();
    
    for (const sub of subscriptions) {
      let allowedDays = sub.selected_days || [];
      if (typeof allowedDays === 'string') {
        try { allowedDays = JSON.parse(allowedDays); } catch(e) {}
      }
      
      const price = sub.discounted_price !== null ? sub.discounted_price : (sub.original_price || 0);
      
      for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const dayOfWeek = d.getDay();
        
        if (allowedDays.includes(dayOfWeek) || allowedDays.includes(String(dayOfWeek))) {
          const { rows: existing } = await client.query(`
            SELECT 1 FROM public.delivery_ledger 
            WHERE user_id = $1 AND product_slug = $2 AND delivery_date = $3
          `, [sub.user_id, sub.product_slug, dateStr]);
          
          if (existing.length === 0) {
            await client.query(`
              INSERT INTO public.delivery_ledger (
                user_id, subscription_id, delivery_date, product_slug, quantity, effective_price, status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [sub.user_id, sub.id, dateStr, sub.product_slug, sub.quantity, price, 'pending']);
            rowsInserted++;
          }
        }
      }
    }
    
    console.log(`Successfully generated ${rowsInserted} future delivery ledger entries!`);
    await client.end();
  } catch (err) {
    console.error(`Execution failed:`, err);
  }
}

run();
