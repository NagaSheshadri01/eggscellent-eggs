-- Add RLS policies for public.subscriptions to allow authenticated customers to insert, update, and delete their own subscriptions

CREATE POLICY "Users insert own subscriptions" ON public.subscriptions 
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own subscriptions" ON public.subscriptions 
  FOR UPDATE TO authenticated 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own subscriptions" ON public.subscriptions 
  FOR DELETE TO authenticated 
  USING (auth.uid() = user_id);

-- Force reload schema cache
NOTIFY pgrst, 'reload schema';
