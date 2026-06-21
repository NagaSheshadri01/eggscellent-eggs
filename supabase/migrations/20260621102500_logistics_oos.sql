-- A. Inject type-decoupled inventory availability indicators into the products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS out_of_stock_one_time BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS out_of_stock_subscriptions BOOLEAN DEFAULT FALSE;

-- B. Enforce strictly isolated, non-cascading row status tracking on the delivery ledger
ALTER TABLE public.delivery_ledger 
DROP CONSTRAINT IF EXISTS check_delivery_ledger_status,
DROP CONSTRAINT IF EXISTS delivery_ledger_status_check;

ALTER TABLE public.delivery_ledger
ADD CONSTRAINT check_delivery_ledger_status 
CHECK (status IN ('pending', 'confirmed', 'out_for_delivery', 'delivered', 'out_of_stock', 'scheduled', 'skipped', 'cancelled', 'paused', 'failed', 'pending_payment'));

-- C. Force PostgREST API schema definitions to rebuild cache elements instantly
NOTIFY pgrst, 'reload schema';
