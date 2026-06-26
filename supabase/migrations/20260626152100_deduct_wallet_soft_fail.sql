CREATE OR REPLACE FUNCTION public.deduct_wallet(
    _user_id uuid,
    _amount numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance numeric;
BEGIN
    -- Fetch current assets
    SELECT balance INTO v_current_balance FROM public.wallets WHERE user_id = _user_id;
    
    -- Soft-fail check instead of transaction-aborting crash
    IF v_current_balance < _amount THEN
        RETURN FALSE;
    END IF;

    -- Execute deduction
    UPDATE public.wallets
    SET balance = balance - _amount
    WHERE user_id = _user_id;

    RETURN TRUE;
END;
$$;
