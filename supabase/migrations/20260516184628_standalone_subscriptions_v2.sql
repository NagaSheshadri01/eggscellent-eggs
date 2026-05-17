-- STANDALONE SUBSCRIPTION SYSTEM V2
-- Drops old tables if they exist to ensure a clean standalone structure
DROP TABLE IF EXISTS public.subscription_deliveries CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;

-- 1. Table tracking the long-term customer subscription contracts
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_slug TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  selected_days INT[] NOT NULL,       -- Array of days: 0=Sunday, 1=Monday, etc. (e.g., [1,3,5])
  address_id UUID REFERENCES public.addresses(id),
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'paused' | 'cancelled'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Table tracking the individual, physical daily deliveries spawned by subscriptions
CREATE TABLE public.subscription_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_partner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'out_for_delivery' | 'delivered' | 'skipped'
  bill_id TEXT UNIQUE NOT NULL,            -- Unique generated ID matching doorstep manifesto notes
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_deliveries ENABLE ROW LEVEL SECURITY;

-- Admin rights
CREATE POLICY "Admins full control subscriptions" ON public.subscriptions FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins full control sub_deliveries" ON public.subscription_deliveries FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public view active sub_deliveries" ON public.subscription_deliveries FOR SELECT TO anon, authenticated 
  USING (status != 'cancelled');

-- Helper to allow users to see their own subscriptions
CREATE POLICY "Users view own subscriptions" ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Force Supabase to refresh its API schema cache
NOTIFY pgrst, 'reload schema';
