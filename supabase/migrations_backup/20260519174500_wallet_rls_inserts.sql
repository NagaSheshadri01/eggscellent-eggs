BEGIN;

-- 1. Grant INSERT privileges for authenticated users on public.wallets
DROP POLICY IF EXISTS "Users can insert their own wallet" ON public.wallets;
CREATE POLICY "Users can insert their own wallet" ON public.wallets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 2. Grant INSERT privileges for authenticated users on public.wallet_transactions
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.wallet_transactions;
CREATE POLICY "Users can insert their own transactions" ON public.wallet_transactions
  FOR INSERT TO authenticated WITH CHECK (
    wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid())
  );

-- 3. Robust backfill: Insert missing wallets for all users
INSERT INTO public.wallets (user_id, balance)
SELECT id, 0.00 FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
NOTIFY pgrst, 'reload schema';
