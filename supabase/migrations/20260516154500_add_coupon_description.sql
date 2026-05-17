-- Add description field to coupons
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS description text;

-- Add is_active alias just in case or keep 'active'
-- We'll keep 'active' as it's already in use.

NOTIFY pgrst, 'reload schema';
