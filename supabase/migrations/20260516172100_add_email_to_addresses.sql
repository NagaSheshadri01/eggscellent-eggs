-- Add email field to addresses table for per-address contact info
ALTER TABLE public.addresses
ADD COLUMN IF NOT EXISTS email TEXT;

NOTIFY pgrst, 'reload schema';
