-- Add RLS policy to allow authenticated users to update their own subscription deliveries (e.g. for cancellation or skipping)
CREATE POLICY "Users update own subscription_deliveries" ON public.subscription_deliveries 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions 
      WHERE subscriptions.id = subscription_deliveries.subscription_id 
      AND subscriptions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.subscriptions 
      WHERE subscriptions.id = subscription_deliveries.subscription_id 
      AND subscriptions.user_id = auth.uid()
    )
  );

-- Force reload schema cache
NOTIFY pgrst, 'reload schema';
