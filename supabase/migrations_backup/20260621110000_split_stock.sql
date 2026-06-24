-- A. Inject distinct stock pool counters
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS stock_one_time INT DEFAULT 100,
ADD COLUMN IF NOT EXISTS stock_subscriptions INT DEFAULT 100;

-- B. Inject explicit manual status override flags
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS out_of_stock_one_time BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS out_of_stock_subscriptions BOOLEAN DEFAULT FALSE;

-- Update existing products to sync values if they were null
UPDATE public.products 
SET stock_one_time = COALESCE(stock_quantity, 100) 
WHERE stock_one_time IS NULL;

UPDATE public.products 
SET stock_subscriptions = COALESCE(stock_quantity, 100) 
WHERE stock_subscriptions IS NULL;

-- C. Enforce clean operational status constraints on the delivery ledger
ALTER TABLE public.delivery_ledger 
DROP CONSTRAINT IF EXISTS check_delivery_ledger_status,
DROP CONSTRAINT IF EXISTS delivery_ledger_status_check;

ALTER TABLE public.delivery_ledger
ADD CONSTRAINT check_delivery_ledger_status 
CHECK (status IN ('pending', 'confirmed', 'out_for_delivery', 'delivered', 'out_of_stock', 'scheduled', 'skipped', 'cancelled', 'paused', 'failed', 'pending_payment'));

-- D. Create synchronization function and trigger for split-stock and legacy compatibility
CREATE OR REPLACE FUNCTION public.sync_product_oos_and_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically set out_of_stock_one_time flag based on stock_one_time
  IF NEW.stock_one_time <= 0 THEN
    NEW.out_of_stock_one_time := TRUE;
  END IF;

  -- Automatically set out_of_stock_subscriptions flag based on stock_subscriptions
  IF NEW.stock_subscriptions <= 0 THEN
    NEW.out_of_stock_subscriptions := TRUE;
  END IF;

  -- Synchronize unified stock_quantity for legacy/client checkout checks
  IF NEW.out_of_stock_one_time = TRUE OR NEW.stock_one_time <= 0 THEN
    NEW.stock_quantity := 0;
  ELSE
    NEW.stock_quantity := NEW.stock_one_time;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_product_oos_and_stock ON public.products;
CREATE TRIGGER trigger_sync_product_oos_and_stock
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_oos_and_stock();

-- E. Instantly flush PostgREST schema cache configurations
NOTIFY pgrst, 'reload schema';
