-- 1. Extend the configuration table parameters
ALTER TABLE public.delivery_config 
ADD COLUMN IF NOT EXISTS min_order_value DECIMAL DEFAULT 150.00,
ADD COLUMN IF NOT EXISTS delivery_tiers JSONB DEFAULT '[
  {"from_km": 0, "to_km": 3, "price": 30},
  {"from_km": 3, "to_km": 7, "price": 50},
  {"from_km": 7, "to_km": 15, "price": 0}
]'::jsonb;
