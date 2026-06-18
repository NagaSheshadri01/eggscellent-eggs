CREATE OR REPLACE FUNCTION public.process_admin_wallet_refund(
  target_order_id UUID,
  refund_amount DECIMAL,
  refund_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
  current_order_status TEXT;
BEGIN
  -- Verify order existence and extract ownership details
  SELECT user_id, order_status INTO target_user_id, current_order_status
  FROM public.orders
  WHERE id = target_order_id;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Target order not found.';
  END IF;

  IF current_order_status = 'refunded' THEN
    RAISE EXCEPTION 'This order has already been fully refunded.';
  END IF;

  -- 1. Flip order status to prevent double-refund vectors
  UPDATE public.orders
  SET order_status = 'refunded',
      updated_at = NOW()
  WHERE id = target_order_id;

  -- 2. Top up the user's wallet resource
  INSERT INTO public.wallets (user_id, balance, updated_at)
  VALUES (target_user_id, refund_amount, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET 
    balance = public.wallets.balance + EXCLUDED.balance,
    updated_at = NOW();

  -- 3. Log an audit entry into the wallet transaction ledger
  INSERT INTO public.wallet_transactions (user_id, order_id, amount, type, description, status)
  VALUES (target_user_id, target_order_id, refund_amount, 'credit', concat('Admin Refund: ', refund_reason), 'completed');

  RETURN TRUE;
END;
$$;
