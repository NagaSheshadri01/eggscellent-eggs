-- Consolidate coupon status columns
-- Ensure 'active' exists and migrate data from 'is_active' if it exists
DO $$ 
BEGIN
    -- 1. If is_active exists but active doesn't, rename it
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='is_active') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='active') THEN
        ALTER TABLE public.coupons RENAME COLUMN is_active TO active;
    
    -- 2. If both exist, migrate is_active into active and drop is_active
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='is_active') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='active') THEN
        UPDATE public.coupons SET active = is_active;
        ALTER TABLE public.coupons DROP COLUMN is_active;
    
    -- 3. If neither exist, create active
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='active') THEN
        ALTER TABLE public.coupons ADD COLUMN active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Force refresh
NOTIFY pgrst, 'reload schema';
