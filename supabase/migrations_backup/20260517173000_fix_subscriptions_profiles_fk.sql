-- Fix the relationship between subscriptions and profiles to allow joins in Supabase client/PostgREST
ALTER TABLE public.subscriptions 
  DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;

ALTER TABLE public.subscriptions 
  ADD CONSTRAINT subscriptions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Force Supabase to refresh its API schema cache
NOTIFY pgrst, 'reload schema';
