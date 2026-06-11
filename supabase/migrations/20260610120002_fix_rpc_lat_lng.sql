BEGIN;

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
    
    -- Pull the targeted saved user address coordinates (using correct 'lat' and 'lng' column names)
    SELECT lat, lng INTO v_user_lat, v_user_lng FROM public.addresses WHERE id = p_address_id;
    
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
