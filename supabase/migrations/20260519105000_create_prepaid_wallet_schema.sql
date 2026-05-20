BEGIN;

-- A. Create the core wallet balance cache table
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  balance NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- B. Create the financial ledger source of truth
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10,2) NOT NULL, -- Positive for recharges/refunds, negative for delivery deductions
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('recharge', 'delivery_deduction', 'refund', 'admin_adjustment', 'compensation')),
  reference_id TEXT, -- Can capture order_id, delivery_ledger_id, or gateway transaction_ids
  created_at TIMESTAMPTZ DEFAULT now()
);

-- C. Enable Row Level Security (RLS) on the new tables
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- D. Create precise RLS Security Policies
DROP POLICY IF EXISTS "Users can view their own wallet" ON public.wallets;
CREATE POLICY "Users can view their own wallet" ON public.wallets
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can view their own transactions" ON public.wallet_transactions;
CREATE POLICY "Users can view their own transactions" ON public.wallet_transactions
  FOR SELECT TO authenticated USING (
    wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid()) 
    OR public.has_role(auth.uid(), 'admin')
  );

-- E. Create automated internal function to provision wallet on registration
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance)
  VALUES (new.id, 0.00)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- F. Attach trigger to the internal authentication schema
DROP TRIGGER IF EXISTS on_auth_user_created_wallet ON auth.users;
CREATE TRIGGER on_auth_user_created_wallet
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_wallet();

-- G. Create automated function to keep wallet balance cache in sync with transactions ledger
CREATE OR REPLACE FUNCTION public.handle_wallet_transaction_inserted()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.wallets
  SET balance = balance + NEW.amount,
      updated_at = now()
  WHERE id = NEW.wallet_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_wallet_transaction_inserted ON public.wallet_transactions;
CREATE TRIGGER on_wallet_transaction_inserted
  AFTER INSERT ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_wallet_transaction_inserted();

-- H. Backfill query: Create missing wallets for any pre-existing users instantly
INSERT INTO public.wallets (user_id, balance)
SELECT id, 0.00 FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
NOTIFY pgrst, 'reload schema';
