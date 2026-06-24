BEGIN;

-- A. Drop any failing or restrictive insert policies if they exist
DROP POLICY IF EXISTS "Users can insert their own calendar delivery entries" ON public.delivery_ledger;

-- B. Create a highly secure INSERT policy for the delivery ledger
CREATE POLICY "Users can insert their own calendar delivery entries" ON public.delivery_ledger
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    -- Rule 1: Ensure the user owns the underlying subscription template they are attaching the add-on to
    subscription_id IN (
      SELECT id FROM public.subscriptions WHERE user_id = auth.uid()
    )
    -- Rule 2: Ensure the insertion uses our strictly mandated status for new calendar requests
    AND status = 'scheduled'
  );

COMMIT;
NOTIFY pgrst, 'reload schema';
