-- Fix Subscription Partner View Rules
CREATE OR REPLACE FUNCTION public.is_subscription_partner(_subscription_id uuid, _user_id uuid)
RETURNS boolean SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.subscription_deliveries
        WHERE subscription_id = _subscription_id AND delivery_partner_id = _user_id
    );
END;
$$;

-- Fix Address View Rules for Active Drops
CREATE OR REPLACE FUNCTION public.is_address_partner(_address_id uuid, _user_id uuid)
RETURNS boolean SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.subscription_deliveries
        WHERE delivery_address_id = _address_id AND delivery_partner_id = _user_id
    ) OR EXISTS (
        SELECT 1 FROM public.one_time_orders
        WHERE delivery_address_id = _address_id AND delivery_partner_id = _user_id
    );
END;
$$;

-- Fix Customer Profile Phone/Name Visibility Rules
CREATE OR REPLACE FUNCTION public.is_profile_partner(_profile_id uuid, _user_id uuid)
RETURNS boolean SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.subscription_deliveries
        WHERE user_id = _profile_id AND delivery_partner_id = _user_id
    ) OR EXISTS (
        SELECT 1 FROM public.one_time_orders
        WHERE user_id = _profile_id AND delivery_partner_id = _user_id
    );
END;
$$;
