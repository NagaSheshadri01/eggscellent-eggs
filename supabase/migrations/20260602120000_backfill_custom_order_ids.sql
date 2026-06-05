BEGIN;

-- Backfill script to populate custom_order_id for all existing rows atomically and collision-free
DO $$
DECLARE
  rec RECORD;
  new_id TEXT;
  id_exists BOOLEAN;
BEGIN
  -- 1. Backfill legacy Orders
  FOR rec IN SELECT id, created_at FROM public.orders WHERE custom_order_id IS NULL LOOP
    LOOP
      new_id := public.generate_custom_order_id('R', rec.created_at::date);
      SELECT EXISTS(SELECT 1 FROM public.orders WHERE custom_order_id = new_id) INTO id_exists;
      IF NOT id_exists THEN
        EXIT;
      END IF;
    END LOOP;
    UPDATE public.orders SET custom_order_id = new_id WHERE id = rec.id;
  END LOOP;

  -- 2. Backfill legacy Delivery Ledger entries
  FOR rec IN SELECT id, delivery_date FROM public.delivery_ledger WHERE custom_order_id IS NULL LOOP
    LOOP
      new_id := public.generate_custom_order_id('S', rec.delivery_date);
      SELECT EXISTS(SELECT 1 FROM public.delivery_ledger WHERE custom_order_id = new_id) INTO id_exists;
      IF NOT id_exists THEN
        EXIT;
      END IF;
    END LOOP;
    UPDATE public.delivery_ledger SET custom_order_id = new_id WHERE id = rec.id;
  END LOOP;
END;
$$;

COMMIT;
NOTIFY pgrst, 'reload schema';
