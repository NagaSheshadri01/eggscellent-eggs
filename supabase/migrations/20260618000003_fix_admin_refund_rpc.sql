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
  target_wallet_id UUID;
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

  -- Find the user's wallet
  SELECT id INTO target_wallet_id 
  FROM public.wallets 
  WHERE user_id = target_user_id;

  IF target_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user.';
  END IF;

  -- 1. Flip order status to prevent double-refund vectors
  UPDATE public.orders
  SET order_status = 'refunded',
      updated_at = NOW()
  WHERE id = target_order_id;

  -- 2. Log an audit entry into the wallet transaction ledger
  -- CRITICAL NOTE: The table has an AFTER INSERT trigger (handle_wallet_transaction_inserted)
  -- that AUTOMATICALLY adds this amount to public.wallets.balance. 
  -- We MUST NOT manually update the wallet balance here, or it will double-credit the user!
  INSERT INTO public.wallet_transactions (wallet_id, amount, transaction_type, reference_id)
  VALUES (
    target_wallet_id, 
    refund_amount, 
    'refund', 
    target_order_id::text || ' | Reason: ' || refund_reason
  );

  RETURN TRUE;
END;
$$;
