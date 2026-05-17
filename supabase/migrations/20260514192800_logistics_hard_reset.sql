-- 0. Drop dependent policies
DROP POLICY IF EXISTS "Partner sees assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Partners update order status" ON public.orders;
DROP POLICY IF EXISTS "Partner sees assigned order items" ON public.order_items;

-- 1. Obliterate all legacy/conflicting constraints (Nuclear Purge)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_partner_id_fkey;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_partner_uuid_fkey;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_partner_identity_fkey;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_final_logistics_fkey;

-- 2. Clear out any old, mismatched ID data to prevent type conflicts
UPDATE public.orders SET delivery_partner_id = NULL;

-- 3. Establish the FINAL Hard-Link to the Master Auth Source
ALTER TABLE public.orders
ADD CONSTRAINT orders_final_logistics_fkey
FOREIGN KEY (delivery_partner_id)
REFERENCES auth.users(id)
ON DELETE SET NULL;

-- 4. Re-add policies
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

-- 5. Reload PostgREST cache
NOTIFY pgrst, 'reload schema';
