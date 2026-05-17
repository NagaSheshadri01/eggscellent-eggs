-- 1. Drop ALL dependent policies across tables
DROP POLICY IF EXISTS "Partner sees assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Partners update order status" ON public.orders;
DROP POLICY IF EXISTS "Partner sees assigned order items" ON public.order_items;

-- 2. Drop the nuclear clean-up and any previous constraints
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_partner_id_fkey;

-- 3. Ensure the column is explicitly UUID type
ALTER TABLE public.orders ALTER COLUMN delivery_partner_id TYPE UUID USING delivery_partner_id::uuid;

-- 4. Establish the final, correct Foreign Key relationship
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

-- 6. Reload PostgREST to reflect changes
NOTIFY pgrst, 'reload schema';
