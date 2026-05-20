-- Seed the early morning subscription slot to satisfy the foreign key constraint on checkout
INSERT INTO public.delivery_slots (slot_key, label, cutoff_time, start_time, end_time, tag, is_active) 
VALUES ('subscription', 'Early Morning Subscription (6:00 AM - 8:00 AM)', '05:00:00', '06:00:00', '08:00:00', 'subscription', true)
ON CONFLICT (slot_key) DO UPDATE 
SET label = EXCLUDED.label, cutoff_time = EXCLUDED.cutoff_time, tag = EXCLUDED.tag, is_active = true;

-- Force reload schema cache
NOTIFY pgrst, 'reload schema';
