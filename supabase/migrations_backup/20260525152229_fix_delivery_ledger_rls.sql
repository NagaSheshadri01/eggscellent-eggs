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

COMMIT;
NOTIFY pgrst, 'reload schema';
