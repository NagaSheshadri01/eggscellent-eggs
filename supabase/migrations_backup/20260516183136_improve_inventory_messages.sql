-- Improve inventory decrement guard with detailed error messages
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
    -- Helpful message with INSUFFICIENT_STOCK prefix for frontend
    RAISE EXCEPTION 'INSUFFICIENT_STOCK: Only % unit(s) of "%" are available (you requested %).',
      _current_stock, _product_name, NEW.quantity;
  END IF;

  UPDATE public.products
     SET stock_quantity = stock_quantity - NEW.quantity
   WHERE id = NEW.product_id;

  RETURN NEW;
END $$;
