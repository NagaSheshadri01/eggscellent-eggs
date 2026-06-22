import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    await pool.query(`
      DROP POLICY IF EXISTS "Users can insert their own calendar delivery entries" ON public.delivery_ledger;
      CREATE POLICY "Users can insert their own calendar delivery entries" ON public.delivery_ledger
      FOR INSERT
      WITH CHECK (
        subscription_id IN (SELECT id FROM subscriptions WHERE user_id = auth.uid()) 
        AND status IN ('pending', 'scheduled', 'pending_payment', 'skipped', 'on_hold')
      );
    `);
    console.log("Policy updated!");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
