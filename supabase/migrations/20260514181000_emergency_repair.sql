-- 1. Hardening Schema for Coupons
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS usage_limit INTEGER DEFAULT 500;

-- 2. Establish Site Settings & CMS Content Tables (using key/value for hook compatibility)
CREATE TABLE IF NOT EXISTS public.site_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cms_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_content ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'site_settings_read') THEN
        CREATE POLICY "site_settings_read" ON public.site_settings FOR SELECT USING (true);
        CREATE POLICY "site_settings_admin" ON public.site_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cms_content_read') THEN
        CREATE POLICY "cms_content_read" ON public.cms_content FOR SELECT USING (true);
        CREATE POLICY "cms_content_admin" ON public.cms_content FOR ALL USING (public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;

-- 3. Force Schema Refresh
NOTIFY pgrst, 'reload schema';
