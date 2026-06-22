import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await pool.query(`
      ALTER TABLE public.orders 
      ADD CONSTRAINT orders_user_id_fkey 
      FOREIGN KEY (user_id) 
      REFERENCES public.profiles(id) 
      ON DELETE CASCADE;
    `);
    console.log("Added foreign key constraint orders_user_id_fkey successfully!");
    
    // Also trigger schema cache reload for PostgREST
    await pool.query(`NOTIFY pgrst, 'reload schema'`);
    console.log("Reloaded schema cache");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
