import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

const sql = `
CREATE TABLE IF NOT EXISTS public.subscription_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  target_date date NOT NULL,
  new_quantity integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(subscription_id, target_date)
);

ALTER TABLE public.subscription_overrides ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION generate_tomorrow_roster()
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
    effective_quantity integer;
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
        -- Check for override
        SELECT new_quantity INTO effective_quantity 
        FROM public.subscription_overrides 
        WHERE subscription_id = sub.id AND target_date = tomorrow_date;
        
        IF NOT FOUND THEN
            effective_quantity := sub.quantity;
        END IF;

        IF effective_quantity > 0 THEN
            required_amount := effective_quantity * sub.price_per_unit;
            
            -- Get user's current MAIN balance
            SELECT balance INTO current_wallet FROM public.profiles WHERE id = sub.user_id;

            IF current_wallet >= required_amount THEN
                -- Deduct directly from main balance
                UPDATE public.profiles SET balance = balance - required_amount WHERE id = sub.user_id;
                
                -- Insert successful drop
                INSERT INTO public.manifest_drops 
                    (manifest_id, subscription_id, user_id, address_id, product_slug, quantity, escrow_amount, status)
                VALUES 
                    (new_manifest_id, sub.id, sub.user_id, sub.address_id, sub.product_slug, effective_quantity, required_amount, 'pending');
            ELSE
                -- Insert failed drop due to insufficient funds
                INSERT INTO public.manifest_drops 
                    (manifest_id, subscription_id, user_id, address_id, product_slug, quantity, escrow_amount, status)
                VALUES 
                    (new_manifest_id, sub.id, sub.user_id, sub.address_id, sub.product_slug, effective_quantity, 0, 'failed_funds');
            END IF;
        END IF;
    END LOOP;
END;
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
