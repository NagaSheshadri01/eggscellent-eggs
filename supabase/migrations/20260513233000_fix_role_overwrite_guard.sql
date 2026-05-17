-- =========================================================
-- Phase 2.1 — UI Simplification & Admin Data Hygiene
-- =========================================================

-- 1. Ensure a unique constraint on user_id so ON CONFLICT (user_id) works
-- Clean up any existing duplicates before applying unique constraint
DELETE FROM public.user_roles WHERE role = 'customer' AND user_id IN (SELECT user_id FROM public.user_roles WHERE role = 'admin');
DELETE FROM public.user_roles a USING (SELECT MIN(id::text)::uuid as min_id, user_id FROM public.user_roles GROUP BY user_id) b WHERE a.user_id = b.user_id AND a.id <> b.min_id;

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

-- 2. Update trigger to prevent role overwrites
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = COALESCE(EXCLUDED.email, public.profiles.email),
    phone      = COALESCE(EXCLUDED.phone, public.profiles.phone),
    full_name  = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url);

  -- Safe insert for user_roles
  INSERT INTO public.user_roles (user_id, role) 
  VALUES (NEW.id, 'customer')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. Insert early morning delivery slot for subscriptions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.delivery_slots WHERE start_time = '06:00:00') THEN
    INSERT INTO public.delivery_slots (start_time, end_time, label, display_order)
    VALUES ('06:00:00', '08:00:00', '06:00 AM – 08:00 AM', 0);
  END IF;
END $$;
