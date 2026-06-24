CREATE OR REPLACE FUNCTION public.terminate_user_subscription(
  target_subscription_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Step 1: Flip the master subscription row status to cancelled
  UPDATE public.subscriptions
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE id = target_subscription_id;

  -- Step 2: Clear matching future ledger line items indefinitely
  -- This leaves standalone one-time additions (where subscription_id is NULL) completely untouched!
  DELETE FROM public.delivery_ledger
  WHERE subscription_id = target_subscription_id
    AND delivery_date >= CURRENT_DATE;

  RETURN TRUE;
END;
$$;
