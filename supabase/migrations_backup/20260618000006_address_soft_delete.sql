-- 1. Add a soft-delete flag column to the addresses table
ALTER TABLE public.addresses 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- 2. Create an index to keep active-user address queries blazing fast
CREATE INDEX IF NOT EXISTS idx_addresses_is_deleted ON public.addresses(is_deleted);
