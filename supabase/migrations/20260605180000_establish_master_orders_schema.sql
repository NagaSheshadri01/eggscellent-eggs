BEGIN;

-- 1. Create the Parent Master Orders Table
CREATE TABLE IF NOT EXISTS public.master_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    custom_order_id TEXT NOT NULL UNIQUE, -- The human-readable string (e.g., ORD-06F405)
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    delivery_date DATE NOT NULL,
    delivery_partner_id UUID REFERENCES public.delivery_partners(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Enforce EXACTLY one master box container per customer per day
    CONSTRAINT unique_customer_delivery_date UNIQUE (user_id, delivery_date)
);

-- Create index for blistering fast logistics clustering queries
CREATE INDEX IF NOT EXISTS idx_master_orders_lookup 
ON public.master_orders(delivery_date, delivery_partner_id);

-- 2. Modify Delivery Ledger to establish the Parent-Child link
ALTER TABLE public.delivery_ledger 
ADD COLUMN IF NOT EXISTS master_order_id UUID REFERENCES public.master_orders(id) ON DELETE CASCADE;

-- 3. Trigger Function: Automatically resolve or create the Parent row on item insertion
CREATE OR REPLACE FUNCTION public.trigger_orchestrate_master_order()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_master_id UUID;
    v_custom_id TEXT;
    v_assigned_driver UUID;
BEGIN
    -- Resolve the user ID from the parent subscription contract or local item fallback
    IF NEW.subscription_id IS NOT NULL THEN
        SELECT user_id INTO v_user_id FROM public.subscriptions WHERE id = NEW.subscription_id;
    ELSE
        v_user_id := NEW.user_id;
    END IF;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Cannot resolve user_id for delivery ledger row.';
    END IF;

    -- Look up if a Master Box row already exists for this customer on this day
    SELECT id, delivery_partner_id INTO v_master_id, v_assigned_driver
    FROM public.master_orders
    WHERE user_id = v_user_id AND delivery_date = NEW.delivery_date;

    -- If it does not exist, mint a new Parent Master Order container on the fly!
    IF v_master_id IS NULL THEN
        LOOP
            v_custom_id := public.generate_custom_order_id('ORD', NEW.delivery_date);
            IF NOT EXISTS (SELECT 1 FROM public.master_orders WHERE custom_order_id = v_custom_id) THEN
                EXIT;
            END IF;
        END LOOP;

        INSERT INTO public.master_orders (custom_order_id, user_id, delivery_date, delivery_partner_id, status)
        VALUES (v_custom_id, v_user_id, NEW.delivery_date, NULL, 'scheduled')
        RETURNING id INTO v_master_id;
    ELSE
        -- PROBLEM 3 SOLVED: If a driver is already assigned to the master box, this new item row inherits them instantly!
        NEW.delivery_partner_id := v_assigned_driver;
    END IF;

    -- Link the child ledger row to the parent master container
    NEW.master_order_id := v_master_id;
    
    -- Sync tracking token text down to the ledger for backwards compatibility
    SELECT custom_order_id INTO NEW.custom_order_id FROM public.master_orders WHERE id = v_master_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Attach the orchestration trigger to the ledger table
DROP TRIGGER IF EXISTS tr_orchestrate_master_order ON public.delivery_ledger;
CREATE TRIGGER tr_orchestrate_master_order
    BEFORE INSERT ON public.delivery_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_orchestrate_master_order();

COMMIT;
