import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    // Scrub bad UUIDs: Nullify driver_id in manifests if it doesn't exist in profiles
    await pool.query(`
      UPDATE public.manifests
      SET driver_id = NULL
      WHERE driver_id IS NOT NULL 
        AND driver_id NOT IN (SELECT id FROM public.profiles);
    `);
    console.log("SUCCESS: Scrubbed bad UUIDs from manifests.driver_id");

    // Add foreign key constraint
    await pool.query(`
      ALTER TABLE public.manifests 
      ADD CONSTRAINT manifests_driver_id_fkey 
      FOREIGN KEY (driver_id) REFERENCES public.profiles(id);
    `);
    console.log("SUCCESS: Added foreign key constraint manifests_driver_id_fkey");

    // Reload schema cache
    await pool.query(`NOTIFY pgrst, 'reload schema';`);
    console.log("SUCCESS: Schema cache reloaded.");
  } catch (error) {
    console.error("ERROR:", error.message);
  } finally {
    pool.end();
  }
}
run();
