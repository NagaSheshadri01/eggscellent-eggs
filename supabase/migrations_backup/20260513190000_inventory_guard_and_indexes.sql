-- =========================================================
-- Phase 1.1 — Inventory Guard (fn_decrement_inventory)
-- Atomically decrements stock_quantity on order_item insert.
-- RAISES EXCEPTION if stock is insufficient → rolls back entire order.
-- Also adds missing performance indexes (Phase 4.2).
-- =========================================================

-- ── Inventory guard function ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_decrement_inventory()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _current_stock integer;
  _product_name  text;
BEGIN
  SELECT stock_quantity, name
    INTO _current_stock, _product_name
    FROM public.products
   WHERE id = NEW.product_id
     FOR UPDATE; -- row-level lock prevents concurrent oversell

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', NEW.product_id;
  END IF;

  IF _current_stock < NEW.quantity THEN
    RAISE EXCEPTION
      'Sorry, only % unit(s) of "%" are available (you requested %).',
      _current_stock, _product_name, NEW.quantity;
  END IF;

  UPDATE public.products
     SET stock_quantity = stock_quantity - NEW.quantity
   WHERE id = NEW.product_id;

  RETURN NEW;
END $$;

-- Drop old trigger if it exists from a previous migration attempt
DROP TRIGGER IF EXISTS trg_decrement_inventory ON public.order_items;

CREATE TRIGGER trg_decrement_inventory
  BEFORE INSERT ON public.order_items
  FOR EACH ROW
  WHEN (NEW.product_id IS NOT NULL)
  EXECUTE FUNCTION public.fn_decrement_inventory();

-- ── Performance indexes (Phase 4.2) ────────────────────────────────────────
-- profiles.phone — used by phone_exists RPC and findUserByPhone in edge fn
CREATE INDEX IF NOT EXISTS idx_profiles_phone  ON public.profiles (phone)  WHERE phone IS NOT NULL;
-- profiles.email — used by email_exists RPC
CREATE INDEX IF NOT EXISTS idx_profiles_email  ON public.profiles (lower(email)) WHERE email IS NOT NULL;
-- orders.user_id — already exists (idx_orders_user), kept for reference
-- order_items.order_id — already exists (idx_order_items_order), kept for reference
-- subscriptions.next_delivery_date — already exists (idx_subs_next)

-- Ensure orders realtime is in the publication (partner portal needs it)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
