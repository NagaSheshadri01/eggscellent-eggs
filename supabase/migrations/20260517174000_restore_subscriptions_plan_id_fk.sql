-- Restore the plan_id foreign key constraint on the subscriptions table that was dropped during CASCADE
ALTER TABLE public.subscriptions 
  DROP CONSTRAINT IF EXISTS subscriptions_plan_id_fkey;

ALTER TABLE public.subscriptions 
  ADD CONSTRAINT subscriptions_plan_id_fkey 
  FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id) ON DELETE SET NULL;

-- Force Supabase to reload cache
NOTIFY pgrst, 'reload schema';
