BEGIN;

CREATE OR REPLACE FUNCTION public.trigger_set_ledger_custom_id()
RETURNS TRIGGER AS $$
DECLARE
  new_id TEXT;
  id_exists BOOLEAN;
  existing_id TEXT;
  v_user_id UUID;
BEGIN
  -- 1. Identify the user owner of the parent subscription contract
  SELECT user_id INTO v_user_id 
  FROM public.subscriptions 
  WHERE id = NEW.subscription_id;

  -- 2. Scan if an order code has already been generated for this user on this delivery date
  SELECT dl.custom_order_id INTO existing_id
  FROM public.delivery_ledger dl
  JOIN public.subscriptions s ON dl.subscription_id = s.id
  WHERE dl.delivery_date = NEW.delivery_date 
    AND s.user_id = v_user_id
    AND dl.custom_order_id IS NOT NULL
  LIMIT 1;

  -- 3. If a master code exists for this box container, reuse it automatically!
  IF existing_id IS NOT NULL THEN
    NEW.custom_order_id := existing_id;
    RETURN NEW;
  END IF;

  -- 4. Otherwise, generate a fresh universal delivery code prefix format (e.g., ORD-DDAXXX)
  LOOP
    new_id := public.generate_custom_order_id('ORD', NEW.delivery_date);
    SELECT EXISTS(SELECT 1 FROM public.orders WHERE custom_order_id = new_id) INTO id_exists;
    IF NOT id_exists THEN
      SELECT EXISTS(SELECT 1 FROM public.delivery_ledger WHERE custom_order_id = new_id) INTO id_exists;
    END IF;
    IF NOT id_exists THEN EXIT; END IF;
  END LOOP;
  
  NEW.custom_order_id := new_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMIT;

-- Force reload schema cache
NOTIFY pgrst, 'reload schema';
