-- 0. Drop dependent policies
DROP POLICY IF EXISTS "Partner sees assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Partners update order status" ON public.orders;
DROP POLICY IF EXISTS "Partner sees assigned order items" ON public.order_items;

-- 1. Wipe invalid/old partner data to allow the type change
UPDATE public.orders SET delivery_partner_id = NULL;

-- 2. Drop the problematic constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_partner_id_fkey;

-- 3. Force the column to be a UUID type
ALTER TABLE public.orders 
ALTER COLUMN delivery_partner_id TYPE UUID USING delivery_partner_id::uuid;

-- 4. Create the CORRECT link to the profiles table (Auth UUID)
ALTER TABLE public.orders
ADD CONSTRAINT orders_delivery_partner_id_fkey
FOREIGN KEY (delivery_partner_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;

-- 5. Re-add the policies
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

-- 6. Notify system of change
NOTIFY pgrst, 'reload schema';
