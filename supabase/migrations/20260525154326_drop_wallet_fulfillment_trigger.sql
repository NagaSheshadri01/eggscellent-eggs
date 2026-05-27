BEGIN;

-- Drop the trigger that forces calendar rows into a pending_payment status
DROP TRIGGER IF EXISTS trigger_evaluate_wallet_fulfillment ON public.delivery_ledger;

-- Drop the underlying function handling the legacy fulfillment evaluation lock
DROP FUNCTION IF EXISTS public.handle_wallet_fulfillment();

COMMIT;
NOTIFY pgrst, 'reload schema';
