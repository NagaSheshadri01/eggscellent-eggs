BEGIN;

-- 1. Drop the implicit unique constraint created by the UNIQUE keyword on delivery_ledger
ALTER TABLE public.delivery_ledger 
DROP CONSTRAINT IF EXISTS delivery_ledger_custom_order_id_key;

-- 2. Drop any unique index that might have been automatically named after it
DROP INDEX IF EXISTS public.delivery_ledger_custom_order_id_key;

-- 3. Create a standard, non-unique index so grouping queries remain blazing fast
CREATE INDEX IF NOT EXISTS idx_delivery_ledger_shared_order_id 
ON public.delivery_ledger(custom_order_id);

COMMIT;

-- Force reload schema cache
NOTIFY pgrst, 'reload schema';
