BEGIN;

CREATE OR REPLACE FUNCTION public.trigger_set_orders_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Set picked_up_at when status becomes 'out_for_delivery'
  IF NEW.order_status = 'out_for_delivery' AND (OLD.order_status IS DISTINCT FROM 'out_for_delivery' OR OLD.order_status IS NULL) THEN
    NEW.picked_up_at := NOW();
  END IF;

  -- Set delivered_at when status becomes 'delivered'
  IF NEW.order_status = 'delivered' AND (OLD.order_status IS DISTINCT FROM 'delivered' OR OLD.order_status IS NULL) THEN
    NEW.delivered_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_orders_timestamps ON public.orders;
CREATE TRIGGER trg_set_orders_timestamps
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_orders_timestamps();

COMMIT;
NOTIFY pgrst, 'reload schema';
