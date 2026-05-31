BEGIN;

-- 1. Create a security definer helper to check if a partner is assigned to a subscription
CREATE OR REPLACE FUNCTION public.is_subscription_partner(_subscription_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.delivery_ledger
    WHERE subscription_id = _subscription_id
    AND delivery_partner_id = _user_id
  );
$$;

-- 2. Permit assigned delivery partners to view subscriptions they are handling (using helper to prevent recursion)
DROP POLICY IF EXISTS "Assigned partners can view subscriptions" ON public.subscriptions;
CREATE POLICY "Assigned partners can view subscriptions" ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (
    public.is_subscription_partner(id, auth.uid())
  );

-- 3. Create a security definer helper to check if a partner is assigned to an address via subscriptions
CREATE OR REPLACE FUNCTION public.is_address_partner(_address_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    JOIN public.delivery_ledger dl ON dl.subscription_id = s.id
    WHERE s.address_id = _address_id
    AND dl.delivery_partner_id = _user_id
  );
$$;

-- 4. Permit assigned delivery partners to view delivery addresses they are handling (using helper to prevent recursion)
DROP POLICY IF EXISTS "Assigned partners can view subscription addresses" ON public.addresses;
CREATE POLICY "Assigned partners can view subscription addresses" ON public.addresses
  FOR SELECT
  TO authenticated
  USING (
    public.is_address_partner(id, auth.uid())
  );

-- 5. Create a security definer helper to check if a partner is assigned to a customer profile
CREATE OR REPLACE FUNCTION public.is_profile_partner(_profile_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    JOIN public.delivery_ledger dl ON dl.subscription_id = s.id
    WHERE s.user_id = _profile_id
    AND dl.delivery_partner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = _profile_id
    AND o.delivery_partner_id = _user_id
  );
$$;

-- 6. Permit assigned delivery partners to view profiles they are delivering to (using helper to prevent recursion)
DROP POLICY IF EXISTS "Assigned partners can view customer profiles" ON public.profiles;
CREATE POLICY "Assigned partners can view customer profiles" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_profile_partner(id, auth.uid())
  );

COMMIT;
NOTIFY pgrst, 'reload schema';
