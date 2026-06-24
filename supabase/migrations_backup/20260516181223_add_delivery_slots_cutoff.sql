-- Add the missing columns to the existing table
ALTER TABLE public.delivery_slots ADD COLUMN IF NOT EXISTS slot_key TEXT UNIQUE;
ALTER TABLE public.delivery_slots ADD COLUMN IF NOT EXISTS cutoff_time TIME;
ALTER TABLE public.delivery_slots ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Make old columns nullable since we are migrating away from them
ALTER TABLE public.delivery_slots ALTER COLUMN start_time DROP NOT NULL;
ALTER TABLE public.delivery_slots ALTER COLUMN end_time DROP NOT NULL;

-- Seed the initial standard shifts
INSERT INTO public.delivery_slots (slot_key, label, cutoff_time, start_time, end_time) VALUES
('slot_8_12', 'Morning Shift (8:00 AM - 12:00 PM)', '09:30:00', '08:00:00', '12:00:00'),
('slot_14_18', 'Afternoon Shift (2:00 PM - 6:00 PM)', '16:00:00', '14:00:00', '18:00:00'),
('slot_18_20', 'Evening Shift (6:00 PM - 8:00 PM)', '18:30:00', '18:00:00', '20:00:00')
ON CONFLICT (slot_key) DO UPDATE 
SET label = EXCLUDED.label, cutoff_time = EXCLUDED.cutoff_time;

-- Force Supabase to refresh its API schema cache
NOTIFY pgrst, 'reload schema';
