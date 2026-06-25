-- A. Inject type-decoupled inventory availability indicators into the products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS out_of_stock_one_time BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS out_of_stock_subscriptions BOOLEAN DEFAULT FALSE;

-- B. Enforce strictly isolated, non-cascading row status tracking on the delivery ledger
DROP TABLE IF EXISTS public.delivery_ledger CASCADE;

-- C. Force PostgREST API schema definitions to rebuild cache elements instantly
NOTIFY pgrst, 'reload schema';
