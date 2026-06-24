-- Add is_vip to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT false;

-- Add is_vip and wallet_mode to subscriptions
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT false;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS wallet_mode BOOLEAN DEFAULT true;

-- Reload schema
NOTIFY pgrst, 'reload schema';
