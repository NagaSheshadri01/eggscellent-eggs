
-- 1. Unique partial indexes on profiles for phone and email (no duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique
  ON public.profiles (phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique
  ON public.profiles (lower(email)) WHERE email IS NOT NULL;

-- 2. Update handle_new_user to upsert (so phone-first user can later add email)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer')
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

-- Make sure trigger is attached on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Auto-grant admin role to specific emails (on profile insert)
CREATE OR REPLACE FUNCTION public.auto_grant_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email IN ('nagasheshadrikalli@gmail.com','nagasheshadri001@gmail.com') THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS auto_grant_admin_trigger ON public.profiles;
CREATE TRIGGER auto_grant_admin_trigger
  AFTER INSERT OR UPDATE OF email ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_grant_admin();

-- 4. RPC: email_exists — public can check if an email is registered
CREATE OR REPLACE FUNCTION public.email_exists(_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE lower(email) = lower(_email)
  );
$$;

GRANT EXECUTE ON FUNCTION public.email_exists(text) TO anon, authenticated;

-- 5. RPC: phone_exists — public can check if a phone is registered
CREATE OR REPLACE FUNCTION public.phone_exists(_phone text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE phone = _phone
  );
$$;

GRANT EXECUTE ON FUNCTION public.phone_exists(text) TO anon, authenticated;
