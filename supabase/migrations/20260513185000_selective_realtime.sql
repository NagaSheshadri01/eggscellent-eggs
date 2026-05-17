-- =========================================================
-- Selective Realtime: disable publication for static tables
-- =========================================================
-- Tables that need realtime (kept):
--   user_roles        → admin promotion instantly updates isAdmin in AuthContext
--   profiles          → JIT identity binding needs live profile reads
--   delivery_partners → partner status changes surface in StaffPortalLink
--   app_settings      → feature_flags hook drives instant-delivery UI toggle
--   orders            → partner portal listens for assigned order updates
--
-- Tables removed from realtime publication (static / admin-only config):
--   faq               → editorial content, no live listener in the frontend
--   content_blocks    → admin-only, mutations invalidate RQ cache manually
--   products          → price changes handled via RQ invalidation on save
--   coupons           → no live coupon feed on the frontend
--   serviceable_pincodes → pincode list fetched with 10-min staleTime
--   delivery_slots    → slot list fetched with 10-min staleTime
--   subscription_plans → plan changes handled via RQ invalidation on save
--   addresses         → private user data, not broadcast
--   order_items       → children of orders; no direct listener
--   subscriptions     → admin reads are paginated, no live feed needed
--   subscription_orders → backend-generated records, no live customer feed
--   site_content      → hero/footer copy, 10-min staleTime, admin-only edits
-- =========================================================

DO $$
DECLARE
  _tables text[] := ARRAY[
    'faq',
    'content_blocks',
    'products',
    'coupons',
    'serviceable_pincodes',
    'delivery_slots',
    'subscription_plans',
    'addresses',
    'order_items',
    'subscriptions',
    'subscription_orders',
    'site_content'
  ];
  _t text;
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    -- Only remove if currently in the publication; ignore if not present
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = _t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', _t);
      RAISE NOTICE 'Removed % from supabase_realtime', _t;
    ELSE
      RAISE NOTICE 'Table % was not in supabase_realtime — skipping', _t;
    END IF;
  END LOOP;
END $$;

-- Confirm the tables still in realtime after this migration.
-- Expected: user_roles, profiles, delivery_partners, app_settings
-- (orders is not explicitly in the publication but benefits from RLS-filtered
--  postgres_changes subscriptions — no change needed there)
