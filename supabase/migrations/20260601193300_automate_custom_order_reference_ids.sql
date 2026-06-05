BEGIN;

-- 1. Create the base generator helper function
CREATE OR REPLACE FUNCTION public.generate_custom_order_id(prefix TEXT, target_date DATE)
RETURNS TEXT AS $$
DECLARE
  month_letters TEXT[] := ARRAY['A','B','C','D','E','F','G','H','I','J','K','L'];
  day_str TEXT;
  month_char TEXT;
  random_num TEXT;
BEGIN
  day_str := to_char(target_date, 'DD');
  month_char := month_letters[extract(month from target_date)::int];
  -- Generate random number between 100 and 999
  random_num := floor(random() * 900 + 100)::text;
  
  RETURN prefix || '-' || day_str || month_char || random_num;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 2. Configure One-Time Orders Table ("orders")
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS custom_order_id TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.trigger_set_orders_custom_id()
RETURNS TRIGGER AS $$
DECLARE
  new_id TEXT;
  id_exists BOOLEAN;
BEGIN
  LOOP
    new_id := public.generate_custom_order_id('R', CURRENT_DATE);
    SELECT EXISTS(SELECT 1 FROM public.orders WHERE custom_order_id = new_id) INTO id_exists;
    IF NOT id_exists THEN EXIT; END IF;
  END LOOP;
  NEW.custom_order_id := new_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_orders_custom_id ON public.orders;
CREATE TRIGGER trg_set_orders_custom_id
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_orders_custom_id();

-- 3. Configure Subscription Deliveries Table ("delivery_ledger")
ALTER TABLE public.delivery_ledger ADD COLUMN IF NOT EXISTS custom_order_id TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.trigger_set_ledger_custom_id()
RETURNS TRIGGER AS $$
DECLARE
  new_id TEXT;
  id_exists BOOLEAN;
BEGIN
  LOOP
    -- Binds the ID to the operational delivery day for high-accuracy parsing
    new_id := public.generate_custom_order_id('S', NEW.delivery_date);
    SELECT EXISTS(SELECT 1 FROM public.delivery_ledger WHERE custom_order_id = new_id) INTO id_exists;
    IF NOT id_exists THEN EXIT; END IF;
  END LOOP;
  NEW.custom_order_id := new_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_ledger_custom_id ON public.delivery_ledger;
CREATE TRIGGER trg_set_ledger_custom_id
  BEFORE INSERT ON public.delivery_ledger
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_ledger_custom_id();

COMMIT;
NOTIFY pgrst, 'reload schema';
