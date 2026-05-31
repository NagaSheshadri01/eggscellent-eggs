BEGIN;

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

COMMIT;
NOTIFY pgrst, 'reload schema';
