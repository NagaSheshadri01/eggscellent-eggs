import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log("Applying schema patch...");
    
    // Add columns
    await pool.query(`
      ALTER TABLE public.subscriptions 
      ADD COLUMN IF NOT EXISTS selected_days text[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS paused_dates date[] DEFAULT '{}';
    `);

    // Add function
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.generate_tomorrow_roster()
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
          new_manifest_id uuid;
          sub record;
          required_escrow numeric;
          tomorrow_date date := CURRENT_DATE + interval '1 day';
      BEGIN
          -- Create the manifest for tomorrow
          INSERT INTO public.manifests (delivery_date, status)
          VALUES (tomorrow_date, 'pending')
          RETURNING id INTO new_manifest_id;

          -- Loop through every active subscription, IGNORING paused dates
          FOR sub IN 
              SELECT * FROM public.subscriptions 
              WHERE status = 'active'
              AND NOT (tomorrow_date = ANY(paused_dates)) -- 🚨 THE SAFETY LOCK
          LOOP
              required_escrow := sub.quantity * sub.price_per_unit;

              BEGIN
                  -- Attempt to lock the funds in Escrow
                  PERFORM public.lock_subscription_funds(sub.user_id, required_escrow);

                  -- Add to tomorrow's delivery truck
                  INSERT INTO public.manifest_drops 
                      (manifest_id, subscription_id, user_id, product_slug, quantity, escrow_amount, status)
                  VALUES 
                      (new_manifest_id, sub.id, sub.user_id, sub.product_slug, sub.quantity, required_escrow, 'pending');
              
              EXCEPTION WHEN OTHERS THEN
                  INSERT INTO public.manifest_drops 
                      (manifest_id, subscription_id, user_id, product_slug, quantity, escrow_amount, status)
                  VALUES 
                      (new_manifest_id, sub.id, sub.user_id, sub.product_slug, sub.quantity, 0, 'failed_funds');
              END;
          END LOOP;
      END;
      $$;
    `);

    console.log("Schema patch applied successfully.");
  } catch(e) {
    console.error("Error applying patch:", e);
  } finally {
    pool.end();
  }
}
run();
