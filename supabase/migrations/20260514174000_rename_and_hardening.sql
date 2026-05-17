-- Rename app_settings to site_settings
ALTER TABLE IF EXISTS public.app_settings RENAME TO site_settings;
-- Rename site_content to cms_content
ALTER TABLE IF EXISTS public.site_content RENAME TO cms_content;

-- Ensure coupons has is_active
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Ensure faq has created_at for chronological ordering
ALTER TABLE public.faq ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
