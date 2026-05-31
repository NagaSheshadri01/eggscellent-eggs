BEGIN;

-- 1. Drop the old status check constraint on delivery_ledger and recreate it to include 'out_for_delivery'
ALTER TABLE public.delivery_ledger 
DROP CONSTRAINT IF EXISTS delivery_ledger_status_check;

ALTER TABLE public.delivery_ledger
ADD CONSTRAINT delivery_ledger_status_check 
CHECK (status IN ('scheduled', 'out_for_delivery', 'delivered', 'paused', 'skipped', 'failed', 'pending_payment', 'cancelled'));

-- 2. Modify the wallets non-negative constraint to allow a negative buffer (e.g. up to -500.00) 
-- to prevent delivery drivers from getting stuck with a constraint violation during drop-off
ALTER TABLE public.wallets 
DROP CONSTRAINT IF EXISTS chk_wallet_balance_non_negative;

ALTER TABLE public.wallets 
ADD CONSTRAINT chk_wallet_balance_non_negative 
CHECK (balance >= -500.00);

COMMIT;
NOTIFY pgrst, 'reload schema';
