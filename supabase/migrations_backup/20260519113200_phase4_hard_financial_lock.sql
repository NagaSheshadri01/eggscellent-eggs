BEGIN;

-- Create app_settings table if it does not already exist
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- A. Erase any pre-existing loose settings references
DELETE FROM public.app_settings WHERE key = 'allow_grace_delivery';

-- B. Seed strict baseline balance thresholds
INSERT INTO public.app_settings (key, value) VALUES
  ('low_balance_warning_threshold', '100.00'),
  ('minimum_subscription_signup_balance', '200.00')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- C. Hard-lock the wallets table to mathematically reject negative balances at the database level
ALTER TABLE public.wallets 
DROP CONSTRAINT IF EXISTS chk_wallet_balance_non_negative;

ALTER TABLE public.wallets 
ADD CONSTRAINT chk_wallet_balance_non_negative 
CHECK (balance >= 0.00);

-- D. Strip out any grace-delivery columns from subscriptions to keep the schema lightweight
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS grace_delivery_consumed;


-- ==========================================
-- E. RULE A: Nightly Manifest Verification Gate & Wallet Check Trigger
-- ==========================================
CREATE OR REPLACE FUNCTION public.evaluate_wallet_fulfillment()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_balance NUMERIC(10,2);
BEGIN
  -- Get user_id of the subscription
  SELECT user_id INTO v_user_id
  FROM public.subscriptions
  WHERE id = NEW.subscription_id;

  -- Get user's wallet balance
  SELECT balance INTO v_balance
  FROM public.wallets
  WHERE user_id = v_user_id;

  -- Check if the status is scheduled or being updated to scheduled
  IF NEW.status = 'scheduled' AND (v_balance IS NULL OR v_balance < NEW.effective_price) THEN
    NEW.status := 'pending_payment';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_evaluate_wallet_fulfillment ON public.delivery_ledger;
CREATE TRIGGER trigger_evaluate_wallet_fulfillment
  BEFORE INSERT OR UPDATE OF status, effective_price ON public.delivery_ledger
  FOR EACH ROW EXECUTE FUNCTION public.evaluate_wallet_fulfillment();


-- ==========================================
-- F. Driver Shift Sync: Synchronize status from old deliveries table to ledger
-- ==========================================
CREATE OR REPLACE FUNCTION public.sync_sub_deliveries_to_ledger()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.delivery_ledger
  SET status = NEW.status
  WHERE subscription_id = NEW.subscription_id
    AND delivery_date = NEW.delivery_date;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_sub_deliveries_to_ledger ON public.subscription_deliveries;
CREATE TRIGGER trigger_sync_sub_deliveries_to_ledger
  AFTER INSERT OR UPDATE OF status ON public.subscription_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.sync_sub_deliveries_to_ledger();


-- ==========================================
-- G. Automated Delivery Deduction Trigger
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_delivery_ledger_status_delivered()
RETURNS TRIGGER AS $$
DECLARE
  v_wallet_id UUID;
  v_user_id UUID;
  v_deduction_amount NUMERIC(10,2);
BEGIN
  -- Execute deductions when status updates to 'delivered'
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
      -- Calculate negative amount
      v_deduction_amount := -1.00 * (NEW.effective_price * NEW.quantity);

      -- Log transaction in the ledger (which updates wallets.balance via handle_wallet_transaction_inserted)
      INSERT INTO public.wallet_transactions (wallet_id, amount, transaction_type, reference_id)
      VALUES (v_wallet_id, v_deduction_amount, 'delivery_deduction', NEW.id::text);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_delivery_ledger_status_delivered ON public.delivery_ledger;
CREATE TRIGGER trigger_delivery_ledger_status_delivered
  BEFORE UPDATE OF status ON public.delivery_ledger
  FOR EACH ROW EXECUTE FUNCTION public.handle_delivery_ledger_status_delivered();


-- ==========================================
-- H. User Notifications & RULE B: Post-Deduction Early Warning Trigger
-- ==========================================
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.user_notifications;
CREATE POLICY "Users can view their own notifications" ON public.user_notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Trigger on wallet balance updates
CREATE OR REPLACE FUNCTION public.check_wallet_low_balance_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_sub_record RECORD;
  v_next_price NUMERIC(10,2);
  v_prod_name TEXT;
BEGIN
  -- Check user's active subscriptions to evaluate the next delivery cost
  FOR v_sub_record IN 
    SELECT s.id, s.product_slug, s.quantity, p.discounted_price, p.name
    FROM public.subscriptions s
    JOIN public.products p ON p.slug = s.product_slug
    WHERE s.user_id = NEW.user_id AND s.status = 'active'
  LOOP
    v_next_price := v_sub_record.discounted_price * v_sub_record.quantity;
    
    -- If balance is less than next delivery cost, issue a high-visibility warning notification
    IF NEW.balance < v_next_price THEN
      INSERT INTO public.user_notifications (user_id, title, message, notification_type, metadata)
      VALUES (
        NEW.user_id,
        'Prepaid Balance Low Warning',
        'Delivery completed! Alert: Your remaining wallet balance (₹' || NEW.balance || ') is less than the price of your next scheduled delivery (₹' || v_next_price || ') for ' || v_sub_record.name || '. Please recharge today to prevent your next morning delivery from being paused.',
        'low_balance',
        jsonb_build_object(
          'subscription_id', v_sub_record.id,
          'current_balance', NEW.balance,
          'next_delivery_cost', v_next_price
        )
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_check_wallet_low_balance ON public.wallets;
CREATE TRIGGER trigger_check_wallet_low_balance
  AFTER UPDATE OF balance ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.check_wallet_low_balance_trigger();

COMMIT;
NOTIFY pgrst, 'reload schema';
