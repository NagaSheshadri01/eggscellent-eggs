CREATE OR REPLACE FUNCTION public.partner_update_order_status(
    _order_id uuid,
    _new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update the normalized retail table instead of the deprecated orders table
    UPDATE public.one_time_orders
    SET status = _new_status
    WHERE id = _order_id;

    -- Optional: If the order could also be a subscription delivery item, handle fallback:
    IF NOT FOUND THEN
        UPDATE public.subscription_deliveries
        SET status = _new_status
        WHERE id = _order_id;
    END IF;
END;
$$;
