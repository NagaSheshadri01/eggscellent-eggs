
-- 1. site_content table
CREATE TABLE IF NOT EXISTS public.site_content (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_content public read"
  ON public.site_content FOR SELECT USING (true);

CREATE POLICY "site_content admin write"
  ON public.site_content FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER site_content_updated_at
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. products.display_order
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_products_display_order ON public.products(display_order);

-- 3. Storage buckets
INSERT INTO storage.buckets (id, name, public)
  VALUES ('product-images', 'product-images', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public)
  VALUES ('site-images', 'site-images', true)
  ON CONFLICT (id) DO NOTHING;

-- 4. Storage policies
CREATE POLICY "public read product-images"
  ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "admin write product-images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update product-images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete product-images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "public read site-images"
  ON storage.objects FOR SELECT USING (bucket_id = 'site-images');
CREATE POLICY "admin write site-images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'site-images' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update site-images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'site-images' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete site-images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'site-images' AND public.has_role(auth.uid(),'admin'));

-- 5. Seed default content
INSERT INTO public.site_content (key, value) VALUES
  ('announcement', '{"enabled": false, "text": "Free delivery above ₹199 — order before 9pm for next-day delivery", "link": ""}'::jsonb),
  ('hero', '{"eyebrow": "100% Natural • FSSAI Certified", "headline_top": "Farm-fresh eggs,", "headline_accent": "delivered", "headline_end": "with care.", "subhead": "Hormone-free, naturally fed and hand-graded. From happy hens to your kitchen — within 24 hours of laying.", "cta_label": "Order Fresh Today", "delivery_note": "Free delivery above ₹199", "image_url": ""}'::jsonb),
  ('products_section', '{"eyebrow": "Today''s collection", "headline": "Today''s Fresh Lay.", "subhead": "Hand-picked this morning, packed with care, on its way to your door."}'::jsonb),
  ('faq_section', '{"eyebrow": "Questions", "headline_left": "Curious?", "headline_right": "We''ve got answers."}'::jsonb),
  ('cta_footer', '{"eyebrow": "Get started", "headline": "Start your healthy routine — every morning.", "subhead": "Premium eggs. Honest farming. Delivered fresh, every morning.", "cta_label": "Order Now"}'::jsonb),
  ('footer', '{"copyright": "Eggscellent. Farm fresh, always.", "links": [{"label":"Contact","href":"#"},{"label":"Privacy","href":"#"},{"label":"Terms","href":"#"}]}'::jsonb)
ON CONFLICT (key) DO NOTHING;
