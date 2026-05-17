-- Fix the partner status update RPC to match the new Auth UUID identity logic
CREATE OR REPLACE FUNCTION public.partner_update_order_status(_order_id uuid, _new_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _is_authorized boolean;
BEGIN
  -- 1. Validate status (Removed 'packed' as per new logistics flow)
  IF _new_status NOT IN ('confirmed', 'out_for_delivery', 'delivered') THEN
    RAISE EXCEPTION 'Invalid status transition: %', _new_status;
  END IF;

  -- 2. Verify that the calling user is the assigned partner for this order
  -- We now match directly against delivery_partner_id which stores the Auth UUID
  SELECT EXISTS(
    SELECT 1 FROM public.orders o
    WHERE o.id = _order_id 
    AND o.delivery_partner_id = auth.uid()
  ) INTO _is_authorized;

  IF NOT _is_authorized THEN 
    RAISE EXCEPTION 'Not authorized: You are not the assigned partner for this order.'; 
  END IF;

  -- 3. Perform the update with timestamp tracking
  UPDATE public.orders SET
    order_status = _new_status::order_status,
    out_for_delivery_at = CASE WHEN _new_status = 'out_for_delivery' THEN COALESCE(out_for_delivery_at, now()) ELSE out_for_delivery_at END,
    delivered_at        = CASE WHEN _new_status = 'delivered' THEN COALESCE(delivered_at, now()) ELSE delivered_at END,
    updated_at = now()
  WHERE id = _order_id;

END; $$;

-- Force refresh
NOTIFY pgrst, 'reload schema';
