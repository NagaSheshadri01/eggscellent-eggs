-- 1. Ensure user_roles has a unique constraint on user_id 
-- This allows us to use 'onConflict: user_id' safely
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

-- 2. Notify PostgREST
NOTIFY pgrst, 'reload schema';
