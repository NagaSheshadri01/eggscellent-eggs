import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await pool.query(`
      ALTER TABLE public.addresses 
      ADD COLUMN IF NOT EXISTS latitude numeric, 
      ADD COLUMN IF NOT EXISTS longitude numeric;
    `);
    console.log("SUCCESS: Added latitude and longitude columns to public.addresses.");

    // Migrate existing data from lat/lng to latitude/longitude
    await pool.query(`
      UPDATE public.addresses 
      SET latitude = lat, longitude = lng 
      WHERE latitude IS NULL AND lat IS NOT NULL;
    `);
    console.log("SUCCESS: Migrated existing lat/lng data to latitude/longitude.");

    await pool.query(`NOTIFY pgrst, 'reload schema';`);
    console.log("SUCCESS: Schema cache reloaded.");
  } catch (error) {
    console.error("ERROR:", error.message);
  } finally {
    pool.end();
  }
}
run();
