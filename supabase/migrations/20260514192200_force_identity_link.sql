-- 0. Drop dependent policies
DROP POLICY IF EXISTS "Partner sees assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Partners update order status" ON public.orders;
DROP POLICY IF EXISTS "Partner sees assigned order items" ON public.order_items;

-- 1. Obliterate all legacy/conflicting constraints
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_partner_id_fkey;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_partner_uuid_fkey;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_partner_identity_fkey;

-- 2. Ensure delivery_partner_id is a strict UUID
ALTER TABLE public.orders 
ALTER COLUMN delivery_partner_id TYPE UUID USING delivery_partner_id::uuid;

-- 3. Create the FINAL master link to the profiles table
ALTER TABLE public.orders
ADD CONSTRAINT orders_partner_identity_fkey
FOREIGN KEY (delivery_partner_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;

-- 4. Re-add the policies
CREATE POLICY "Partner sees assigned orders" ON public.orders 
FOR SELECT 
USING (auth.uid() = delivery_partner_id);

CREATE POLICY "Partners update order status" ON public.orders
FOR UPDATE
USING (auth.uid() = delivery_partner_id)
WITH CHECK (auth.uid() = delivery_partner_id);

CREATE POLICY "Partner sees assigned order items" ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id 
    AND o.delivery_partner_id = auth.uid()
  )
);

-- 5. Notify the system to refresh its mapping
NOTIFY pgrst, 'reload schema';
