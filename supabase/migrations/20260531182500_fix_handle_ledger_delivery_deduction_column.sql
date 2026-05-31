BEGIN;

-- Redefine handle_ledger_delivery_deduction to correctly query the wallets table 
-- to get v_wallet_id and insert into public.wallet_transactions using the proper 'wallet_id' column 
-- instead of the non-existent 'user_id' column.
CREATE OR REPLACE FUNCTION public.handle_ledger_delivery_deduction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id uuid;
  v_wallet_id uuid;
BEGIN
  -- When a driver slides to 'delivered', deduct the wallet balance instantly
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    -- Get user_id of the subscription
    SELECT user_id INTO v_user_id
    FROM public.subscriptions
    WHERE id = NEW.subscription_id;

    -- Get wallet ID
    SELECT id INTO v_wallet_id
    FROM public.wallets
    WHERE user_id = v_user_id;

    IF v_wallet_id IS NOT NULL THEN
      INSERT INTO public.wallet_transactions (wallet_id, amount, transaction_type, reference_id)
      VALUES (
        v_wallet_id,
        -(NEW.effective_price * NEW.quantity), -- CRITICAL FIX: Pulled directly from the ledger row!
        'delivery_deduction',
        NEW.id::text
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

COMMIT;
NOTIFY pgrst, 'reload schema';
