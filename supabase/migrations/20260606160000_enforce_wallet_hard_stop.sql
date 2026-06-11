BEGIN;

-- 1. Refactor the wallet deduction trigger to intercept insufficient funds
CREATE OR REPLACE FUNCTION public.trigger_enforce_wallet_delivery_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_current_balance NUMERIC;
  v_user_id UUID;
BEGIN
  -- Only intercept if the row is transitioning to a successful 'delivered' status
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    
    -- Resolve the user ID linked to this box/item
    SELECT user_id INTO v_user_id 
    FROM public.master_orders 
    WHERE id = NEW.master_order_id;

    -- Fetch the current real-time prepaid balance
    SELECT balance INTO v_current_balance 
    FROM public.wallets 
    WHERE user_id = v_user_id;

    -- CRITICAL GUARD: If the wallet cannot cover this item's price, block the delivery charge
    IF v_current_balance < NEW.effective_price THEN
      -- Automatically flip the item status to 'skipped' with an explicit log state
      NEW.status := 'skipped';
      RETURN NEW;
    END IF;

    -- Deduct the funds cleanly if the balance is sufficient
    UPDATE public.wallets 
    SET balance = balance - NEW.effective_price,
        updated_at = NOW()
    WHERE user_id = v_user_id;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Ensure the trigger is attached to delivery_ledger
DROP TRIGGER IF EXISTS trigger_enforce_wallet_delivery_payment ON public.delivery_ledger;
CREATE TRIGGER trigger_enforce_wallet_delivery_payment
BEFORE UPDATE ON public.delivery_ledger
FOR EACH ROW
EXECUTE FUNCTION public.trigger_enforce_wallet_delivery_payment();


-- Append this directly to your 20260606160000_enforce_wallet_hard_stop.sql migration
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'wallet';

CREATE OR REPLACE FUNCTION public.process_wallet_checkout(
    p_user_id UUID,
    p_grand_total NUMERIC,
    p_address_id UUID,
    p_items JSONB -- Array of checkout items to write to order_items
) RETURNS UUID AS $$
DECLARE
    v_current_balance NUMERIC;
    v_order_id UUID;
    v_item RECORD;
BEGIN
    -- 1. Lock and verify wallet balance to prevent concurrent multi-window race conditions
    SELECT balance INTO v_current_balance FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
    IF v_current_balance < p_grand_total THEN
        RAISE EXCEPTION 'Insufficient wallet funds for this checkout operation.';
    END IF;

    -- 2. Deduct funds from the user's wallet
    UPDATE public.wallets SET balance = balance - p_grand_total, updated_at = NOW() WHERE user_id = p_user_id;

    -- 3. Log the ledger activity audit row
    INSERT INTO public.wallet_transactions (user_id, amount, type, reference_context)
    VALUES (p_user_id, -p_grand_total, 'retail_purchase', 'Storefront Checkout');

    -- 4. Create the parent order entry (setting subtotal = grand_total, delivery_fee/discount = 0 for simplicity if not provided)
    INSERT INTO public.orders (user_id, total, subtotal, delivery_fee, discount, address_id, payment_method, payment_status, order_status)
    VALUES (p_user_id, p_grand_total, p_grand_total, 0, 0, p_address_id, 'wallet', 'paid', 'placed')
    RETURNING id INTO v_order_id;

    -- 5. Unpack JSONB array and map line items directly into order_items
    INSERT INTO public.order_items (order_id, product_id, product_name, product_image, unit, quantity, price)
    SELECT v_order_id, product_id, product_name, product_image, unit, quantity, price
    FROM jsonb_to_recordset(p_items) AS x(product_id uuid, product_name text, product_image text, unit text, quantity int, price numeric);

    RETURN v_order_id;
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMIT;
