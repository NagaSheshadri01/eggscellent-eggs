BEGIN;

-- 1. Surgical extraction of the accidental unique restriction rule
ALTER TABLE public.delivery_ledger 
DROP CONSTRAINT IF EXISTS delivery_ledger_custom_order_id_key;

-- 2. Drop the automatic unique index matching the constraint (various possible names)
DROP INDEX IF EXISTS public.delivery_ledger_custom_order_id_key;
DROP INDEX IF EXISTS public.idx_delivery_ledger_shared_order_id;

-- 3. Establish a standard, non-unique performance index so multi-line route queries stay optimized
CREATE INDEX IF NOT EXISTS idx_delivery_ledger_shared_box_id 
ON public.delivery_ledger(custom_order_id);

-- 4. RETROACTIVE IMMUNIZATION: Automatically fill in the missing delivery rows for the next 14 days
--    This covers any rows that were previously blocked by the accidental unique constraint.
DO $$
DECLARE
    v_date DATE;
    v_sub RECORD;
    v_day_index TEXT;
    v_plan_price NUMERIC;
BEGIN
    FOR v_date IN SELECT generate_series(CURRENT_DATE::TIMESTAMP, (CURRENT_DATE + INTERVAL '14 days')::TIMESTAMP, INTERVAL '1 day')::DATE LOOP
        v_day_index := extract(dow from v_date)::TEXT;

        FOR v_sub IN 
            SELECT s.id, s.product_slug, s.quantity, s.plan_id
            FROM public.subscriptions s
            WHERE s.status = 'active' 
              AND s.selected_days::TEXT[] @> ARRAY[v_day_index]
        LOOP
            -- If a specific item row was skipped or blocked by the unique key, generate it now
            IF NOT EXISTS (
                SELECT 1 FROM public.delivery_ledger 
                WHERE subscription_id = v_sub.id AND delivery_date = v_date
            ) THEN
                
                SELECT price_per_delivery INTO v_plan_price 
                FROM public.subscription_plans 
                WHERE id = v_sub.plan_id;

                INSERT INTO public.delivery_ledger (
                    subscription_id,
                    delivery_date,
                    product_slug,
                    quantity,
                    effective_price,
                    status
                ) VALUES (
                    v_sub.id,
                    v_date,
                    v_sub.product_slug,
                    v_sub.quantity,
                    COALESCE(v_plan_price, 0),
                    'scheduled'
                );
            END IF;
        END LOOP;
    END LOOP;
END $$;

COMMIT;

-- Force PostgREST to reload its schema cache so the new index is visible immediately
NOTIFY pgrst, 'reload schema';
