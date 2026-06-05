BEGIN;

CREATE OR REPLACE FUNCTION public.trigger_set_ledger_custom_id()
RETURNS TRIGGER AS $$
DECLARE
  new_id TEXT;
  id_exists BOOLEAN;
  v_core_product TEXT;
  v_prefix TEXT;
BEGIN
  -- 1. Look up the primary product slug belonging to the base subscription contract
  SELECT product_slug INTO v_core_product 
  FROM public.subscriptions 
  WHERE id = NEW.subscription_id;

  -- 2. If it matches the core plan item, it is an 'S' track. If it's an add-on, it is an 'R' track.
  IF NEW.product_slug = v_core_product THEN
    v_prefix := 'S';
  ELSE
    v_prefix := 'R';
  END IF;

  -- 3. Mint a completely unique, non-shared reference code for this specific line item row
  LOOP
    new_id := public.generate_custom_order_id(v_prefix, NEW.delivery_date);
    SELECT EXISTS(SELECT 1 FROM public.delivery_ledger WHERE custom_order_id = new_id) INTO id_exists;
    IF NOT id_exists THEN EXIT; END IF;
  END LOOP;
  
  NEW.custom_order_id := new_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMIT;

-- Force reload schema cache
NOTIFY pgrst, 'reload schema';
