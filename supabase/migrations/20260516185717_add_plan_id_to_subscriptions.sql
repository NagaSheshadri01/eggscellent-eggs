-- Add plan_id to subscriptions table for linkage to subscription_plans
ALTER TABLE public.subscriptions 
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.subscription_plans(id);

-- Force Supabase to refresh its API schema cache
NOTIFY pgrst, 'reload schema';
