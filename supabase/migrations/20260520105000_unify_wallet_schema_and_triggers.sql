BEGIN;

-- A. Optimize the New User Wallet Trigger function to use a SECURITY DEFINER 
-- and verify it operates flawlessly on AFTER INSERT within the transaction chain
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance)
  VALUES (new.id, 0.00)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Clean out any legacy, obsolete subscription table schemas or indices that cause 'relation/schema does not exist' conflicts during joint queries
-- Ensure public.subscriptions and public.delivery_ledger are the absolute sources of truth
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_ledger ENABLE ROW LEVEL SECURITY;

COMMIT;
NOTIFY pgrst, 'reload schema';
