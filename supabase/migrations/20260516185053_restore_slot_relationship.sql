-- 1. Restore relationship between orders and delivery_slots using slot_key
-- Note: slot_key is already unique in delivery_slots
ALTER TABLE public.orders 
  ADD CONSTRAINT orders_slot_id_fkey 
  FOREIGN KEY (slot_id) 
  REFERENCES public.delivery_slots(slot_key);

-- 2. Restore missing frequency column in subscriptions table
-- This is needed for the customer-side subscription logic
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS frequency TEXT;

-- Force Supabase to refresh its API schema cache
NOTIFY pgrst, 'reload schema';
