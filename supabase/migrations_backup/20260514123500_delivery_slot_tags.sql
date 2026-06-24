-- Add tag column to delivery_slots
ALTER TABLE public.delivery_slots ADD COLUMN IF NOT EXISTS tag text DEFAULT 'one_time';

-- Deactivate all slots first
UPDATE public.delivery_slots SET active = false;

-- 6:00 AM - 8:00 AM (Subscription)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.delivery_slots WHERE start_time = '06:00:00') THEN
    UPDATE public.delivery_slots SET active = true, end_time = '08:00:00', label = '6:00 AM – 8:00 AM', tag = 'subscription', display_order = 1 WHERE start_time = '06:00:00';
  ELSE
    INSERT INTO public.delivery_slots (start_time, end_time, label, display_order, active, tag) VALUES ('06:00:00', '08:00:00', '6:00 AM – 8:00 AM', 1, true, 'subscription');
  END IF;
END $$;

-- 8:00 AM - 12:00 PM (One Time)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.delivery_slots WHERE start_time = '08:00:00') THEN
    UPDATE public.delivery_slots SET active = true, end_time = '12:00:00', label = '8:00 AM – 12:00 PM', tag = 'one_time', display_order = 2 WHERE start_time = '08:00:00';
  ELSE
    INSERT INTO public.delivery_slots (start_time, end_time, label, display_order, active, tag) VALUES ('08:00:00', '12:00:00', '8:00 AM – 12:00 PM', 2, true, 'one_time');
  END IF;
END $$;

-- 2:00 PM - 6:00 PM (One Time)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.delivery_slots WHERE start_time = '14:00:00') THEN
    UPDATE public.delivery_slots SET active = true, end_time = '18:00:00', label = '2:00 PM – 6:00 PM', tag = 'one_time', display_order = 3 WHERE start_time = '14:00:00';
  ELSE
    INSERT INTO public.delivery_slots (start_time, end_time, label, display_order, active, tag) VALUES ('14:00:00', '18:00:00', '2:00 PM – 6:00 PM', 3, true, 'one_time');
  END IF;
END $$;

-- 6:00 PM - 8:00 PM (One Time)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.delivery_slots WHERE start_time = '18:00:00') THEN
    UPDATE public.delivery_slots SET active = true, end_time = '20:00:00', label = '6:00 PM – 8:00 PM', tag = 'one_time', display_order = 4 WHERE start_time = '18:00:00';
  ELSE
    INSERT INTO public.delivery_slots (start_time, end_time, label, display_order, active, tag) VALUES ('18:00:00', '20:00:00', '6:00 PM – 8:00 PM', 4, true, 'one_time');
  END IF;
END $$;

-- We also have a 09:00 and 17:00 slot in the system that wasn't deactivated properly above?
-- The first UPDATE set everything to inactive. The DO blocks above activated the correct ones.
