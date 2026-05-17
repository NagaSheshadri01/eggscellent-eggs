-- 1. Identify and Clean Orphaned IDs
UPDATE public.orders 
SET delivery_partner_id = NULL 
WHERE delivery_partner_id IS NOT NULL 
AND delivery_partner_id NOT IN (SELECT id FROM auth.users);

-- 2. Repair Constraint to point to the Master Auth Source
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_partner_id_fkey;

ALTER TABLE public.orders
ADD CONSTRAINT orders_delivery_partner_id_fkey
FOREIGN KEY (delivery_partner_id)
REFERENCES auth.users(id)
ON DELETE SET NULL;

-- 3. Notify PostgREST
NOTIFY pgrst, 'reload schema';
