-- Add usage_limit column to coupons table
ALTER TABLE public.coupons 
ADD COLUMN IF NOT EXISTS usage_limit INTEGER DEFAULT 500;

-- Also add a column to track current usage to make the limit functional
ALTER TABLE public.coupons 
ADD COLUMN IF NOT EXISTS used_count INTEGER DEFAULT 0;

-- Refresh cache
NOTIFY pgrst, 'reload schema';
