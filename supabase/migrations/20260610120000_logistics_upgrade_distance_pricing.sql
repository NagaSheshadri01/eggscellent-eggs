BEGIN;

-- 1. Upgrade the Addresses table to store descriptive labels and contact fallbacks
ALTER TABLE public.addresses 
ADD COLUMN IF NOT EXISTS address_name TEXT, -- E.g., "Lyra"
ADD COLUMN IF NOT EXISTS address_phone TEXT, -- E.g., "+914567891230"
ADD COLUMN IF NOT EXISTS area_locality TEXT, -- E.g., "Alwal"
ADD COLUMN IF NOT EXISTS address_tag TEXT DEFAULT 'Home'; -- 'Home', 'Work', 'Custom'

-- 2. Create the Admin Delivery Configuration Table
CREATE TABLE IF NOT EXISTS public.delivery_config (
    id INT PRIMARY KEY DEFAULT 1,
    store_latitude NUMERIC(10, 7) NOT NULL DEFAULT 17.5011000, -- Default Hyderabad Anchor
    store_longitude NUMERIC(10, 7) NOT NULL DEFAULT 78.5020000,
    CONSTRAINT single_row_lock CHECK (id = 1) -- Guarantees exactly one configuration row
);

-- 3. Create the Distance-Based Pricing Tiers Table
CREATE TABLE IF NOT EXISTS public.delivery_pricing_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    max_distance_km NUMERIC(5, 2) NOT NULL, -- E.g., 1.00, 2.00, 5.00
    delivery_fee NUMERIC(6, 2) NOT NULL,    -- E.g., 20.00, 40.00, 0.00 (Free)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial standard dummy rules (Admin can change these anytime)
INSERT INTO public.delivery_config (id, store_latitude, store_longitude) 
VALUES (1, 17.5011000, 78.5020000) ON CONFLICT DO NOTHING;

INSERT INTO public.delivery_pricing_tiers (max_distance_km, delivery_fee) VALUES 
(1.00, 15.00), -- Under 1km: Rs 15
(2.00, 25.00), -- Under 2km: Rs 25
(5.00, 0.00)   -- Under 5km: Free Delivery
ON CONFLICT DO NOTHING;

-- 4. Create the Haversine Distance-Fee Calculator Stored Procedure (RPC)
CREATE OR REPLACE FUNCTION public.calculate_order_delivery_fee(p_address_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_store_lat NUMERIC;
    v_store_lng NUMERIC;
    v_user_lat NUMERIC;
    v_user_lng NUMERIC;
    v_distance_km NUMERIC;
    v_fee NUMERIC;
BEGIN
    -- Pull the admin's active store coordinates
    SELECT store_latitude, store_longitude INTO v_store_lat, v_store_lng FROM public.delivery_config WHERE id = 1;
    
    -- Pull the targeted saved user address coordinates
    SELECT latitude, longitude INTO v_user_lat, v_user_lng FROM public.addresses WHERE id = p_address_id;
    
    IF v_user_lat IS NULL OR v_user_lng IS NULL THEN
        RETURN 0.00; -- Fallback if coordinates missing
    END IF;

    -- Execute Haversine spherical geometry formula to find absolute straight-line distance in kilometers
    v_distance_km := 6371 * acos(
        cos(radians(v_store_lat)) * cos(radians(v_user_lat)) * cos(radians(v_user_lng) - radians(v_store_lng)) + 
        sin(radians(v_store_lat)) * sin(radians(v_user_lat))
    );

    -- Find the cheapest matching distance tier for this delivery radius
    SELECT delivery_fee INTO v_fee 
    FROM public.delivery_pricing_tiers
    WHERE max_distance_km >= v_distance_km
    ORDER BY max_distance_km ASC
    LIMIT 1;

    -- Return the calculated fee, fallback to 0 if outside standard tiers
    RETURN COALESCE(v_fee, 0.00);
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMIT;
