BEGIN;

-- 1. Permit assigned delivery partners to view subscriptions they are handling
DROP POLICY IF EXISTS "Assigned partners can view subscriptions" ON public.subscriptions;
CREATE POLICY "Assigned partners can view subscriptions" ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_ledger dl
      WHERE dl.subscription_id = public.subscriptions.id
      AND dl.delivery_partner_id = auth.uid()
    )
  );

-- 2. Permit assigned delivery partners to view delivery addresses they are handling
DROP POLICY IF EXISTS "Assigned partners can view subscription addresses" ON public.addresses;
CREATE POLICY "Assigned partners can view subscription addresses" ON public.addresses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      JOIN public.delivery_ledger dl ON dl.subscription_id = s.id
      WHERE s.address_id = public.addresses.id
      AND dl.delivery_partner_id = auth.uid()
    )
  );

-- 3. Permit assigned delivery partners to view profiles they are delivering to
DROP POLICY IF EXISTS "Assigned partners can view customer profiles" ON public.profiles;
CREATE POLICY "Assigned partners can view customer profiles" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    -- Assigned via subscription delivery ledger:
    OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      JOIN public.delivery_ledger dl ON dl.subscription_id = s.id
      WHERE s.user_id = public.profiles.id
      AND dl.delivery_partner_id = auth.uid()
    )
    -- Assigned via normal instant orders:
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.user_id = public.profiles.id
      AND o.delivery_partner_id = auth.uid()
    )
  );

COMMIT;
NOTIFY pgrst, 'reload schema';
