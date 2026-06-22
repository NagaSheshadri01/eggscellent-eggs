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
      console.log("Attempt " + (i+1));
      await pool.query(`
        ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
        ALTER TABLE public.orders 
        ADD CONSTRAINT orders_user_id_fkey 
        FOREIGN KEY (user_id) 
        REFERENCES public.profiles(id) 
        ON DELETE CASCADE;
        
        NOTIFY pgrst, 'reload schema';
      `);
      console.log("Successfully replaced orders_user_id_fkey to reference public.profiles!");
      break;
    } catch (err) {
      console.error("Error:", err.message);
      if (err.code === 'ENOTFOUND') {
        await delay(2000);
        continue;
      }
      break;
    }
  }
  pool.end();
}
run();
