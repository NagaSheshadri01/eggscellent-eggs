-- 1. FIX COUPONS: Add the missing status column
ALTER TABLE public.coupons 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. FIX CMS: Create the authoritative cms_content table
CREATE TABLE IF NOT EXISTS public.cms_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. FIX SETTINGS: Create the authoritative site_settings table
CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. PERMISSIONS: Secure the tables for Admin management
ALTER TABLE public.cms_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    -- CMS Policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin All Access CMS') THEN
        CREATE POLICY "Admin All Access CMS" ON public.cms_content FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Read Access') THEN
        CREATE POLICY "Public Read Access" ON public.cms_content FOR SELECT USING (true);
    END IF;
    
    -- Settings Policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin All Access Settings') THEN
        CREATE POLICY "Admin All Access Settings" ON public.site_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Read Access Settings') THEN
        CREATE POLICY "Public Read Access Settings" ON public.site_settings FOR SELECT USING (true);
    END IF;
END $$;

-- 5. REFRESH CACHE
NOTIFY pgrst, 'reload schema';
