-- Ensure Admins can view all orders
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' 
        AND policyname = 'Admins can view all orders'
    ) THEN
        CREATE POLICY "Admins can view all orders" ON public.orders 
        FOR SELECT TO authenticated 
        USING (public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;

-- Add explicit relationship from orders to profiles to enable auto-joins
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'orders_user_id_fkey'
    ) THEN
        ALTER TABLE public.orders 
        ADD CONSTRAINT orders_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.profiles(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- Add explicit relationship from orders to addresses to enable auto-joins
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'orders_address_id_fkey'
    ) THEN
        ALTER TABLE public.orders 
        ADD CONSTRAINT orders_address_id_fkey 
        FOREIGN KEY (address_id) REFERENCES public.addresses(id)
        ON DELETE SET NULL;
    END IF;
END $$;
