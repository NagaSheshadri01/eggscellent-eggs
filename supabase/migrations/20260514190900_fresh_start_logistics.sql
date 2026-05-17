-- 1. Fresh Start: Wipe existing partner records to resolve corrupt identity states
TRUNCATE TABLE public.delivery_partners;

-- 2. Hardening: Ensure user_id is a UNIQUE UUID to prevent duplicate partner records
ALTER TABLE public.delivery_partners 
ADD CONSTRAINT unique_partner_user_id UNIQUE (user_id);

-- 3. Stability: Re-link the orders table to the profiles table
-- We point to profiles(id) as the authoritative master UUID for logistics
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_partner_id_fkey;

ALTER TABLE public.orders 
ADD CONSTRAINT orders_delivery_partner_id_fkey 
FOREIGN KEY (delivery_partner_id) 
REFERENCES public.profiles(id)
ON DELETE SET NULL;

-- 4. Reload PostgREST cache
NOTIFY pgrst, 'reload schema';
