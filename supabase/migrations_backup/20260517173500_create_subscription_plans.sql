-- Clean recreate of the subscription_plans table to guarantee all columns and policies exist
DROP TABLE IF EXISTS public.subscription_plans CASCADE;

CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,                -- e.g., 'Daily Fresh Eggs Pack'
  description TEXT,                  -- e.g., 'Get 12 fresh family-pack eggs delivered before 8 AM'
  product_slug TEXT NOT NULL,         -- Links to inventory catalog (e.g., 'white-eggs-12pc')
  quantity INT NOT NULL DEFAULT 1,    -- Number of items per delivery instance
  frequency_type TEXT NOT NULL,       -- 'daily' | 'alternate' | 'custom_days'
  custom_days INT[],                 -- Array mapping fixed delivery days: [1,3,5] for Mon/Wed/Fri
  price_per_delivery NUMERIC(10,2) NOT NULL, -- Isolated recurring cost item
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security and grant Admin configuration rights
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full control sub_plans" ON public.subscription_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public view active sub_plans" ON public.subscription_plans FOR SELECT TO anon, authenticated USING (is_active = true);

NOTIFY pgrst, 'reload schema';
