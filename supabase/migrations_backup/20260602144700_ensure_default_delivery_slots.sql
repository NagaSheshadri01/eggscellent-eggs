-- Ensure all standard and subscription delivery slots exist in the database
INSERT INTO public.delivery_slots (slot_key, label, cutoff_time, start_time, end_time, tag, is_active) 
VALUES 
  ('subscription', 'Early Morning Subscription (6:00 AM - 8:00 AM)', '05:00:00', '06:00:00', '08:00:00', 'subscription', true),
  ('slot_8_12', 'Morning Shift (8:00 AM - 12:00 PM)', '09:30:00', '08:00:00', '12:00:00', 'one_time', true),
  ('slot_14_18', 'Afternoon Shift (2:00 PM - 6:00 PM)', '16:00:00', '14:00:00', '18:00:00', 'one_time', true),
  ('slot_18_20', 'Evening Shift (6:00 PM - 8:00 PM)', '18:30:00', '18:00:00', '20:00:00', 'one_time', true)
ON CONFLICT (slot_key) DO UPDATE 
SET 
  label = EXCLUDED.label, 
  cutoff_time = EXCLUDED.cutoff_time, 
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  tag = EXCLUDED.tag, 
  is_active = EXCLUDED.is_active;

-- Force reload schema cache
NOTIFY pgrst, 'reload schema';
