-- Restore missing legacy columns to subscriptions table for frontend compatibility
ALTER TABLE public.subscriptions 
  ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS next_delivery_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS slot_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cod',
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);

-- Add relationship for slot_id in subscriptions too
ALTER TABLE public.subscriptions 
  DROP CONSTRAINT IF EXISTS subscriptions_slot_id_fkey,
  ADD CONSTRAINT subscriptions_slot_id_fkey 
  FOREIGN KEY (slot_id) 
  REFERENCES public.delivery_slots(slot_key);

-- Force Supabase to refresh its API schema cache
NOTIFY pgrst, 'reload schema';
