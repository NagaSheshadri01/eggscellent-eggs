import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('1. Adding display_id and backfilling...');
    await pool.query(`
      ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS display_id text;
      
      UPDATE public.subscriptions 
      SET display_id = 'SUB-' || substr(id::text, 1, 8) 
      WHERE display_id IS NULL;
    `);
    console.log('Done 1');

    console.log('2. Updating generate_tomorrow_roster()...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.generate_tomorrow_roster()
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
          new_manifest_id uuid;
          sub record;
          required_amount numeric;
          current_wallet numeric;
          tomorrow_date date := CURRENT_DATE + interval '1 day';
      BEGIN
          -- 1. Create the manifest for tomorrow
          INSERT INTO public.manifests (delivery_date, status)
          VALUES (tomorrow_date, 'pending')
          RETURNING id INTO new_manifest_id;

          -- 2. Loop through every active subscription, honoring paused dates
          FOR sub IN 
              SELECT * FROM public.subscriptions 
              WHERE status = 'active'
              AND NOT (tomorrow_date = ANY(COALESCE(paused_dates, ARRAY[]::date[])))
          LOOP
              required_amount := sub.quantity * sub.price_per_unit;
              
              -- Get user's current MAIN balance (DO NOT USE reserved_balance)
              SELECT balance INTO current_wallet FROM public.profiles WHERE id = sub.user_id;

              IF current_wallet >= required_amount THEN
                  -- Deduct directly from main balance
                  UPDATE public.profiles SET balance = balance - required_amount WHERE id = sub.user_id;
                  
                  -- Insert successful drop
                  INSERT INTO public.manifest_drops 
                      (manifest_id, subscription_id, user_id, address_id, product_slug, quantity, escrow_amount, status)
                  VALUES 
                      (new_manifest_id, sub.id, sub.user_id, sub.address_id, sub.product_slug, sub.quantity, required_amount, 'pending');
              ELSE
                  -- Insert failed drop due to insufficient funds
                  INSERT INTO public.manifest_drops 
                      (manifest_id, subscription_id, user_id, address_id, product_slug, quantity, escrow_amount, status)
                  VALUES 
                      (new_manifest_id, sub.id, sub.user_id, sub.address_id, sub.product_slug, sub.quantity, 0, 'failed_funds');
              END IF;
          END LOOP;
      END;
      $$;
    `);
    console.log('Done 2');
    
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
