-- 1. Drop existing complex partner policy
DROP POLICY IF EXISTS "Partner sees assigned orders" ON public.orders;

-- 2. Create simplified policy matching auth.uid() directly for reliability
CREATE POLICY "Partner sees assigned orders" ON public.orders 
FOR SELECT 
USING (auth.uid() = delivery_partner_id);

-- 3. Update order items policy as well
DROP POLICY IF EXISTS "Partner sees assigned order items" ON public.order_items;
CREATE POLICY "Partner sees assigned order items" ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id 
    AND o.delivery_partner_id = auth.uid()
  )
);

-- 4. Allow partners to update status
CREATE POLICY "Partners update order status" ON public.orders
FOR UPDATE
USING (auth.uid() = delivery_partner_id)
WITH CHECK (auth.uid() = delivery_partner_id);
