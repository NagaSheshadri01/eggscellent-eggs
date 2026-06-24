-- 1. Ensure the unified delivery_config table has the correct columns
ALTER TABLE public.delivery_config 
ADD COLUMN IF NOT EXISTS min_order_value DECIMAL DEFAULT 120.00,
ADD COLUMN IF NOT EXISTS delivery_tiers JSONB DEFAULT '[]'::jsonb;

-- 2. Clean out any default legacy rows if they clash, ensuring a base config row exists
INSERT INTO public.delivery_config (id, store_latitude, store_longitude, min_order_value, delivery_tiers)
VALUES (1, 17.5219466, 78.4989884, 120.00, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;
