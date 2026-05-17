-- Migrate products table from single image_url to multiple images array
-- 1. Add images column as text array
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';

-- 2. Migrate existing image_url data to the images array
UPDATE public.products 
SET images = ARRAY[image_url] 
WHERE image_url IS NOT NULL AND (images IS NULL OR array_length(images, 1) IS NULL);

-- 3. We keep image_url for now for backward compatibility in case of slow rollout, 
-- but all new logic will use the images array.

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
