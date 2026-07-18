import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

const sql = `
ALTER TABLE public.subscription_overrides ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own subscription overrides') THEN
        CREATE POLICY "Users can view their own subscription overrides" ON public.subscription_overrides
            FOR SELECT USING (
                auth.uid() IN (
                    SELECT user_id FROM public.subscriptions WHERE id = subscription_id
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own subscription overrides') THEN
        CREATE POLICY "Users can insert their own subscription overrides" ON public.subscription_overrides
            FOR INSERT WITH CHECK (
                auth.uid() IN (
                    SELECT user_id FROM public.subscriptions WHERE id = subscription_id
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own subscription overrides') THEN
        CREATE POLICY "Users can update their own subscription overrides" ON public.subscription_overrides
            FOR UPDATE USING (
                auth.uid() IN (
                    SELECT user_id FROM public.subscriptions WHERE id = subscription_id
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own subscription overrides') THEN
        CREATE POLICY "Users can delete their own subscription overrides" ON public.subscription_overrides
            FOR DELETE USING (
                auth.uid() IN (
                    SELECT user_id FROM public.subscriptions WHERE id = subscription_id
                )
            );
    END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
`;

async function run() {
  try {
    await pool.query(sql);
    console.log("SQL executed successfully");
  } catch (err) {
    console.error("ERROR:", err.message);
  } finally {
    pool.end();
  }
}
run();
