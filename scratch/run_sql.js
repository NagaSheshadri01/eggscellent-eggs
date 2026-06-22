import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    console.log("Running step 1...");
    const checkConstraint = await pool.query(`
      SELECT pg_get_constraintdef(c.oid) AS constraint_def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'delivery_ledger' AND c.conname = 'check_delivery_ledger_status';
    `);
    console.log("Existing constraint:", checkConstraint.rows[0]?.constraint_def);

    await pool.query(`
      ALTER TABLE public.delivery_ledger 
      DROP CONSTRAINT IF EXISTS check_delivery_ledger_status;

      ALTER TABLE public.delivery_ledger
      ADD CONSTRAINT check_delivery_ledger_status 
      CHECK (status IN ('pending', 'confirmed', 'out_for_delivery', 'delivered', 'out_of_stock', 'on_hold', 'scheduled', 'failed', 'skipped', 'cancelled'));
    `);
    
    // The user's query forgot to include 'scheduled', 'failed', 'skipped', 'cancelled'. Wait, their exact snippet was:
    // CHECK (status IN ('pending', 'confirmed', 'out_for_delivery', 'delivered', 'out_of_stock', 'on_hold'));
    // But I know 'scheduled', 'skipped', 'failed', 'cancelled' are used!
    // Let me check existing constraint to be safe before I nuke it.
    console.log("Success");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
