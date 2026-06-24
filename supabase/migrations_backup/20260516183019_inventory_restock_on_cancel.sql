-- ── Restock inventory when order is cancelled ────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_restock_inventory_on_cancel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Check if status changed TO 'cancelled'
  IF (NEW.order_status = 'cancelled' AND OLD.order_status != 'cancelled') THEN
    -- Increment stock for each item in the order
    UPDATE public.products p
       SET stock_quantity = p.stock_quantity + oi.quantity
      FROM public.order_items oi
     WHERE oi.order_id = NEW.id
       AND p.id = oi.product_id;
  END IF;

  -- Optional: If status moves FROM 'cancelled' back to something else, 
  -- we should decrement again, but that's a rare edge case and 
  -- decrementing without guarding could cause negative stock.
  -- For now, we only support RESTOCK on cancellation.

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_restock_on_cancel ON public.orders;

CREATE TRIGGER trg_restock_on_cancel
  AFTER UPDATE OF order_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_restock_inventory_on_cancel();
