-- Allow assigned partners to view the delivery address for orders they are handling
-- This fix ensures that partners can see the lat/lng coordinates in their portal
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Assigned partners can view delivery addresses') THEN
        CREATE POLICY "Assigned partners can view delivery addresses" ON public.addresses
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.address_id = public.addresses.id
            AND o.delivery_partner_id = auth.uid()
          )
        );
    END IF;
END $$;

-- Force refresh
NOTIFY pgrst, 'reload schema';
