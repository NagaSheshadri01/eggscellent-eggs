-- Change slot_id type to TEXT to accommodate slot_keys
-- 1. Drop existing foreign key constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_slot_id_fkey;

-- 2. Change column type from UUID to TEXT
ALTER TABLE public.orders ALTER COLUMN slot_id TYPE text;

-- 3. Update existing UUIDs to their corresponding keys if possible (Optional but good)
-- For now, just allowing the type change is the priority to unblock checkout.

-- Force Supabase to refresh its API schema cache
NOTIFY pgrst, 'reload schema';
