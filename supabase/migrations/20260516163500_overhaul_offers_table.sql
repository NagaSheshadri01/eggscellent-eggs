-- Overhaul offers table for flexible rule-based engine
DROP TABLE IF EXISTS public.offers CASCADE;

CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  offer_type TEXT NOT NULL DEFAULT 'product_discount',
    -- 'product_discount' | 'free_delivery' | 'product_free' | 'bundle_buy'
  min_order_value NUMERIC(10,2) DEFAULT 0.00,

  -- For condition checks & payouts
  required_product_slugs TEXT[],  -- for bundle_buy: all slugs must be in cart
  reward_product_slug TEXT,        -- for product_free: slug of the bonus item
  coupon_code_to_apply TEXT,       -- for product_discount: hooks into coupons table

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins manage offers" ON public.offers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Public view active offers" ON public.offers FOR SELECT TO anon, authenticated USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
