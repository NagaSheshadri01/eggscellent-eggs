-- =========================================================
-- Phase 2 — High-Precision Geolocation
-- =========================================================

ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS lat NUMERIC;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS lng NUMERIC;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS lat NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS lng NUMERIC;
