ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS lat numeric;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS lng numeric;
ALTER TABLE public.orders    ADD COLUMN IF NOT EXISTS lat numeric;
ALTER TABLE public.orders    ADD COLUMN IF NOT EXISTS lng numeric;

INSERT INTO public.app_settings(key, value)
VALUES ('feature_flags', '{"instant_delivery_enabled": false, "partners": []}'::jsonb)
ON CONFLICT (key) DO NOTHING;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;