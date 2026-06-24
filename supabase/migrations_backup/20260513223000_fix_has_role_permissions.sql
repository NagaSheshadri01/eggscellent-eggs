-- =========================================================
-- Phase 1.5 — Fix RLS Admin Access (Restore has_role execution)
-- =========================================================

-- In a previous security lockdown, EXECUTE was revoked on has_role.
-- However, Postgres evaluates RLS policies using the privileges of the calling role 
-- (e.g., authenticated). If 'authenticated' cannot execute has_role, any RLS policy 
-- that relies on it will fail with "permission denied", preventing admins from getting access.

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
