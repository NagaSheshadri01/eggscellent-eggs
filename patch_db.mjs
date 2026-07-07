import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.tdnqhyzccuspszbnvjtz:' + encodeURIComponent('A01b02z26y25_SPB') + '@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log("Starting Database execution step...");

    // 1. check_wallet_low_balance_trigger
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.check_wallet_low_balance_trigger()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        v_sub_record RECORD;
        v_next_price NUMERIC(10,2);
      BEGIN
        FOR v_sub_record IN 
          SELECT s.id, s.product_slug, s.quantity, p.discounted_price, p.name
          FROM public.subscriptions s
          JOIN public.products p ON p.slug = s.product_slug
          WHERE s.user_id = NEW.user_id AND s.status = 'active'
        LOOP
          v_next_price := v_sub_record.discounted_price * v_sub_record.quantity;
          
          IF NEW.balance < v_next_price THEN
            INSERT INTO public.user_notifications (user_id, title, message, notification_type, metadata)
            VALUES (
              NEW.user_id,
              'Prepaid Balance Low Warning',
              'Your wallet balance (' || NEW.balance || ') is lower than the next delivery cost (' || v_next_price || ') for ' || v_sub_record.name || '. Please recharge to avoid interruptions.',
              'alert',
              jsonb_build_object('subscription_id', v_sub_record.id, 'shortfall', v_next_price - NEW.balance)
            );
          END IF;
        END LOOP;
        
        RETURN NEW;
      END;
      $$;
    `);
    console.log("1. Rewrote check_wallet_low_balance_trigger");

    // 2. partner_update_order_status
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.partner_update_order_status(_order_id uuid, _new_status text)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
          UPDATE public.one_time_orders
          SET status = _new_status
          WHERE id = _order_id;

          IF NOT FOUND THEN
              UPDATE public.manifest_drops
              SET status = _new_status
              WHERE id = _order_id;
          END IF;
      END;
      $$;
    `);
    console.log("2. Rewrote partner_update_order_status");

    // 3. subscriptions table
    await pool.query(`
      ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS address_id uuid REFERENCES public.addresses(id);
      
      UPDATE public.subscriptions s
      SET address_id = (
        SELECT id FROM public.addresses a 
        WHERE a.user_id = s.user_id 
        ORDER BY is_default DESC, created_at DESC 
        LIMIT 1
      )
      WHERE s.address_id IS NULL;
    `);
    console.log("3. Patched subscriptions and backfilled address_id");

    // 4. manifest_drops table
    await pool.query(`
      ALTER TABLE public.manifest_drops ADD COLUMN IF NOT EXISTS address_id uuid REFERENCES public.addresses(id);
    `);
    console.log("4. Patched manifest_drops table");

    // 5. generate_tomorrow_roster
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
          INSERT INTO public.manifests (delivery_date, status)
          VALUES (tomorrow_date, 'pending')
          RETURNING id INTO new_manifest_id;

          FOR sub IN 
              SELECT * FROM public.subscriptions 
              WHERE status = 'active'
              AND NOT (tomorrow_date = ANY(paused_dates))
          LOOP
              required_escrow := sub.quantity * sub.price_per_unit;

              BEGIN
                  PERFORM public.lock_subscription_funds(sub.user_id, required_escrow);

                  INSERT INTO public.manifest_drops 
                      (manifest_id, subscription_id, user_id, product_slug, quantity, escrow_amount, status, address_id)
                  VALUES 
                      (new_manifest_id, sub.id, sub.user_id, sub.product_slug, sub.quantity, required_escrow, 'pending', sub.address_id);
              
              EXCEPTION WHEN OTHERS THEN
                  INSERT INTO public.manifest_drops 
                      (manifest_id, subscription_id, user_id, product_slug, quantity, escrow_amount, status, address_id)
                  VALUES 
                      (new_manifest_id, sub.id, sub.user_id, sub.product_slug, sub.quantity, 0, 'failed_funds', sub.address_id);
              END;
          END LOOP;
      END;
      $$;
    `);
    console.log("5. Rewrote generate_tomorrow_roster");
    
    console.log("Database execution step COMPLETE.");
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
