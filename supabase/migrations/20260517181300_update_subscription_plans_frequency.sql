-- Remove outdated custom configurations
DELETE FROM public.subscription_plans WHERE frequency_type = 'customplan';

-- Add explicit support for unique single-day weekly intervals if missing
ALTER TABLE public.subscription_plans 
DROP CONSTRAINT IF EXISTS check_frequency_type;

ALTER TABLE public.subscription_plans 
ADD CONSTRAINT check_frequency_type 
CHECK (frequency_type IN ('daily', 'alternate', 'weekly', 'custom_days'));

-- Force schema reload
NOTIFY pgrst, 'reload schema';
