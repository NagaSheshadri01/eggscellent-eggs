-- Add scheduled_date to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS scheduled_date DATE;

-- Force Supabase to refresh its API schema cache
NOTIFY pgrst, 'reload schema';
