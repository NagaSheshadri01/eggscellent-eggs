BEGIN;

-- 1. Drop the incorrect foreign key constraint that references delivery_partners(id)
ALTER TABLE public.master_orders
DROP CONSTRAINT IF EXISTS master_orders_delivery_partner_id_fkey;

-- 2. Add the correct foreign key constraint referencing profiles(id), matching how delivery_partner_id is used everywhere else
ALTER TABLE public.master_orders
ADD CONSTRAINT master_orders_delivery_partner_id_fkey
FOREIGN KEY (delivery_partner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Backfill master_orders for existing delivery_ledger rows
INSERT INTO public.master_orders (custom_order_id, user_id, delivery_date, delivery_partner_id, status)
SELECT 
    MIN(COALESCE(dl.custom_order_id, public.generate_custom_order_id('ORD', dl.delivery_date))),
    s.user_id,
    dl.delivery_date,
    MAX(dl.delivery_partner_id::text)::uuid,
    'scheduled'
FROM public.delivery_ledger dl
JOIN public.subscriptions s ON dl.subscription_id = s.id
WHERE dl.master_order_id IS NULL
GROUP BY s.user_id, dl.delivery_date
ON CONFLICT (user_id, delivery_date) DO NOTHING;

-- 4. Link child ledger rows back to their parent master_orders
UPDATE public.delivery_ledger dl
SET master_order_id = mo.id,
    custom_order_id = mo.custom_order_id,
    delivery_partner_id = COALESCE(dl.delivery_partner_id, mo.delivery_partner_id)
FROM public.master_orders mo
JOIN public.subscriptions s ON s.user_id = mo.user_id
WHERE dl.master_order_id IS NULL
  AND mo.delivery_date = dl.delivery_date
  AND s.id = dl.subscription_id;

COMMIT;
