-- 1. Surgical Clean of Orphaned Partner Metadata
-- If a partner has a user_id that doesn't exist in Auth, they are blocking assignments
DELETE FROM public.delivery_partners 
WHERE user_id IS NOT NULL 
AND user_id NOT IN (SELECT id FROM auth.users);

-- 2. Repair the Orders Foreign Key to point to the Master Identity (Auth)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_partner_id_fkey;

ALTER TABLE public.orders
ADD CONSTRAINT orders_delivery_partner_id_fkey
FOREIGN KEY (delivery_partner_id)
REFERENCES auth.users(id)
ON DELETE SET NULL;

-- 3. Notify PostgREST to refresh schema cache
NOTIFY pgrst, 'reload schema';
