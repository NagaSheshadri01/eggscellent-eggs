BEGIN;

-- A. Introduce a Parent Product Grouping column to identify interchangeable lines (e.g., 6-pack vs 12-pack)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS parent_group_id TEXT DEFAULT NULL;

-- B. Update the catalog plans table to track max delivery caps and pricing modes
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS max_deliveries_per_week INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_vip_eligible BOOLEAN DEFAULT false;

-- C. Backfill example grouping data for testing
UPDATE public.products 
SET parent_group_id = 'white-eggs-family' 
WHERE slug IN ('white-eggs-6pc', 'white-eggs-12pc');

-- D. Enforce absolute subscription duplicate prevention policy
-- Prevents a user from creating two identical active subscription templates for the same product slug
DROP INDEX IF EXISTS idx_unique_active_user_sub_slug;
CREATE UNIQUE INDEX idx_unique_active_user_sub_slug 
ON public.subscriptions (user_id, product_slug) 
WHERE (status IN ('active', 'paused'));

COMMIT;
NOTIFY pgrst, 'reload schema';
