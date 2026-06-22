import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
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
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
