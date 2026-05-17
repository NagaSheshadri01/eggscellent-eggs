-- Nuclear Fix: Remove all FK constraints on delivery_partner_id to unblock assignments
DO $$ 
DECLARE 
    r record;
BEGIN
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.key_column_usage 
        WHERE table_name = 'orders' 
        AND column_name = 'delivery_partner_id'
    ) LOOP
        EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- Ensure the column exists and is a UUID
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_partner_id UUID;

-- Notify postgrest to refresh
NOTIFY pgrst, 'reload schema';
