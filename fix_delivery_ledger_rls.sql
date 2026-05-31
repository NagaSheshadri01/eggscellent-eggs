BEGIN;

-- 1. Fix the INSERT Policy
DROP POLICY IF EXISTS "Users can insert their own calendar delivery entries" ON public.delivery_ledger;
CREATE POLICY "Users can insert their own calendar delivery entries" ON public.delivery_ledger
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    subscription_id IN (
      SELECT id FROM public.subscriptions WHERE user_id = auth.uid()
    )
    AND status IN ('scheduled', 'pending_payment', 'skipped')
  );

-- 2. Fix the UPDATE Policy
DROP POLICY IF EXISTS "Users can update future delivery ledger entries" ON public.delivery_ledger;
CREATE POLICY "Users can update future delivery ledger entries" ON public.delivery_ledger
  FOR UPDATE 
  TO authenticated 
  USING (
    subscription_id IN (SELECT id FROM public.subscriptions WHERE user_id = auth.uid())
  )
  WITH CHECK (
    status IN ('scheduled', 'pending_payment', 'skipped', 'cancelled')
  );

-- 3. Add Admin Full Control Policy on public.delivery_ledger
DROP POLICY IF EXISTS "Admins full control delivery_ledger" ON public.delivery_ledger;
CREATE POLICY "Admins full control delivery_ledger" ON public.delivery_ledger
  FOR ALL 
  TO authenticated 
  USING (
    public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
  );

-- 4. Permit assigned delivery partners to view and update their assigned delivery stops
DROP POLICY IF EXISTS "Assigned partners can view and update their deliveries" ON public.delivery_ledger;
CREATE POLICY "Assigned partners can view and update their deliveries" ON public.delivery_ledger
  FOR ALL
  TO authenticated
  USING (
    delivery_partner_id = auth.uid()
  )
  WITH CHECK (
    delivery_partner_id = auth.uid()
  );

COMMIT;
NOTIFY pgrst, 'reload schema';
