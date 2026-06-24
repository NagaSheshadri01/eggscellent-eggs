BEGIN;

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
