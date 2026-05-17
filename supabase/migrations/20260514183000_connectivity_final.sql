-- 1. Ensure Site Settings & CMS Content Tables (using key/value)
CREATE TABLE IF NOT EXISTS public.site_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key text UNIQUE, value jsonb, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.cms_content (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key text UNIQUE, value jsonb, updated_at timestamptz DEFAULT now());

-- 2. RLS for Site Settings
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public view settings') THEN
        CREATE POLICY "Public view settings" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);
        CREATE POLICY "Admins manage settings" ON public.site_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;

-- 3. RLS for CMS Content
ALTER TABLE public.cms_content ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public view CMS') THEN
        CREATE POLICY "Public view CMS" ON public.cms_content FOR SELECT TO anon, authenticated USING (true);
        CREATE POLICY "Admins manage CMS" ON public.cms_content FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;

-- 4. RLS for Coupons (Fix "Failed to Fetch" on INSERT)
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage coupons') THEN
        CREATE POLICY "Admins manage coupons" ON public.coupons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
        CREATE POLICY "Public view coupons" ON public.coupons FOR SELECT TO anon, authenticated USING (is_active = true);
    END IF;
END $$;

-- 5. Force Schema Refresh
NOTIFY pgrst, 'reload schema';
