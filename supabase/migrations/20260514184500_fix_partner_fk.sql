-- 1. Identify and drop the existing foreign key constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_partner_id_fkey;

-- 1.5 Clean Orphans before re-establishing FK
-- This prevents the "violates foreign key constraint" error during migration
UPDATE public.orders SET delivery_partner_id = NULL 
WHERE delivery_partner_id IS NOT NULL 
AND delivery_partner_id NOT IN (SELECT id FROM public.profiles);

-- 2. Establish a new foreign key pointing to the profiles table (Auth UUID)
-- This ensures that delivery_partner_id stores the user's stable identity
ALTER TABLE public.orders
ADD CONSTRAINT orders_delivery_partner_id_fkey
FOREIGN KEY (delivery_partner_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;

-- 3. Notify postgrest to refresh
NOTIFY pgrst, 'reload schema';
