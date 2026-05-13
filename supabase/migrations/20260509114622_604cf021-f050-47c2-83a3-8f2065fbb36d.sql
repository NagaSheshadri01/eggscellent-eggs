
-- =========================================================
-- PHASE 1: APP SETTINGS + SERVICEABLE PINCODES
-- =========================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings public read" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "app_settings admin write" ON public.app_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER app_settings_set_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings(key, value) VALUES
  ('delivery', jsonb_build_object(
    'delivery_fee', 29,
    'free_delivery_threshold', 199,
    'minimum_order_amount', 99,
    'max_delivery_radius_km', 15,
    'delivery_enabled', true,
    'delivery_start_time', '06:00',
    'delivery_end_time', '20:00'
  )),
  ('business', jsonb_build_object(
    'business_name', 'Eggscellent',
    'support_phone', '+91 99999 99999',
    'support_email', 'hello@eggscellent.in',
    'whatsapp_number', '+919999999999'
  ))
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.serviceable_pincodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pincode text NOT NULL UNIQUE,
  area_name text,
  active boolean NOT NULL DEFAULT true,
  delivery_fee_override numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_serviceable_pincodes_pin ON public.serviceable_pincodes(pincode);
ALTER TABLE public.serviceable_pincodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pincodes public read" ON public.serviceable_pincodes FOR SELECT USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Pincodes admin manage" ON public.serviceable_pincodes FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER pincodes_set_updated_at BEFORE UPDATE ON public.serviceable_pincodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.serviceable_pincodes(pincode, area_name) VALUES
  ('400050','Bandra West'), ('400051','Bandra East'), ('400053','Andheri West'),
  ('400055','Santacruz'), ('400049','Khar West'), ('400054','Santacruz West')
ON CONFLICT (pincode) DO NOTHING;

-- =========================================================
-- PHASE 4: DELIVERY SLOTS + ORDERS COLUMNS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.delivery_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Slots public read" ON public.delivery_slots FOR SELECT USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Slots admin manage" ON public.delivery_slots FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER slots_set_updated_at BEFORE UPDATE ON public.delivery_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.delivery_slots(label, start_time, end_time, display_order) VALUES
  ('9 AM – 12 PM', '09:00', '12:00', 1),
  ('2 PM – 5 PM', '14:00', '17:00', 2),
  ('5 PM – 8 PM', '17:00', '20:00', 3);

-- =========================================================
-- PHASE 3: DELIVERY PARTNERS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.delivery_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  full_name text NOT NULL,
  phone text NOT NULL UNIQUE,
  email text,
  vehicle_type text,
  city text,
  pincode text,
  availability jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  active boolean NOT NULL DEFAULT false,
  aadhaar_url text,
  license_url text,
  experience_years int,
  assigned_areas text[] NOT NULL DEFAULT '{}',
  assigned_slot_ids uuid[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_partners ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an application (public form). Auth not required.
CREATE POLICY "Anyone can apply as partner" ON public.delivery_partners FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Partner sees own row" ON public.delivery_partners FOR SELECT
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin manages partners" ON public.delivery_partners FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_partners_user ON public.delivery_partners(user_id);
CREATE INDEX IF NOT EXISTS idx_partners_status ON public.delivery_partners(status);

CREATE TRIGGER partners_set_updated_at BEFORE UPDATE ON public.delivery_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for partner KYC docs (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('partner-docs', 'partner-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Partner docs public upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'partner-docs');
CREATE POLICY "Partner docs admin read" ON storage.objects FOR SELECT
  USING (bucket_id = 'partner-docs' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Partner docs admin manage" ON storage.objects FOR ALL
  USING (bucket_id = 'partner-docs' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'partner-docs' AND public.has_role(auth.uid(), 'admin'));

-- Helper: is the current user an active approved partner?
CREATE OR REPLACE FUNCTION public.is_active_partner(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.delivery_partners
    WHERE user_id = _uid AND active = true AND status = 'approved'
  );
$$;

-- =========================================================
-- ORDERS: extend with slot, partner assignment, timestamps
-- =========================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS slot_id uuid REFERENCES public.delivery_slots(id),
  ADD COLUMN IF NOT EXISTS delivery_partner_id uuid REFERENCES public.delivery_partners(id),
  ADD COLUMN IF NOT EXISTS picked_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS out_for_delivery_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS pincode text;

CREATE INDEX IF NOT EXISTS idx_orders_user_created ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_slot ON public.orders(slot_id);
CREATE INDEX IF NOT EXISTS idx_orders_partner ON public.orders(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_pincode ON public.orders(pincode);

-- Partner can view their assigned orders
CREATE POLICY "Partner sees assigned orders" ON public.orders FOR SELECT
  USING (
    delivery_partner_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.delivery_partners dp
      WHERE dp.id = orders.delivery_partner_id AND dp.user_id = auth.uid()
    )
  );

-- Partner can view items of their assigned orders
CREATE POLICY "Partner sees assigned order items" ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.delivery_partners dp ON dp.id = o.delivery_partner_id
      WHERE o.id = order_items.order_id AND dp.user_id = auth.uid()
    )
  );

-- RPC for partner status updates (security definer, scoped)
CREATE OR REPLACE FUNCTION public.partner_update_order_status(_order_id uuid, _new_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _is_partner boolean;
BEGIN
  IF _new_status NOT IN ('confirmed','packed','out_for_delivery','delivered') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.orders o
    JOIN public.delivery_partners dp ON dp.id = o.delivery_partner_id
    WHERE o.id = _order_id AND dp.user_id = auth.uid() AND dp.active = true
  ) INTO _is_partner;
  IF NOT _is_partner THEN RAISE EXCEPTION 'Not authorized'; END IF;

  UPDATE public.orders SET
    order_status = _new_status::order_status,
    picked_up_at        = CASE WHEN _new_status = 'packed' THEN COALESCE(picked_up_at, now()) ELSE picked_up_at END,
    out_for_delivery_at = CASE WHEN _new_status = 'out_for_delivery' THEN COALESCE(out_for_delivery_at, now()) ELSE out_for_delivery_at END,
    delivered_at        = CASE WHEN _new_status = 'delivered' THEN COALESCE(delivered_at, now()) ELSE delivered_at END
  WHERE id = _order_id;
END $$;

-- =========================================================
-- PHASE 5: SUBSCRIPTIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  frequency text NOT NULL, -- daily|alternate|weekly|monthly
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  default_quantity int NOT NULL DEFAULT 1,
  duration_days int,
  discount_type text DEFAULT 'percent',
  discount_value numeric DEFAULT 0,
  popular boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans public read" ON public.subscription_plans FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Plans admin manage" ON public.subscription_plans FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER plans_set_updated_at BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid REFERENCES public.subscription_plans(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity int NOT NULL DEFAULT 1,
  frequency text NOT NULL,
  start_date date NOT NULL,
  next_delivery_date date NOT NULL,
  end_date date,
  status text NOT NULL DEFAULT 'active', -- active|paused|cancelled
  slot_id uuid REFERENCES public.delivery_slots(id),
  address_id uuid REFERENCES public.addresses(id),
  payment_method text NOT NULL DEFAULT 'cod',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subs_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subs_next ON public.subscriptions(next_delivery_date);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own subscriptions" ON public.subscriptions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin sees all subscriptions" ON public.subscriptions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER subs_set_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.subscription_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id),
  scheduled_for date NOT NULL,
  status text NOT NULL DEFAULT 'scheduled', -- scheduled|skipped|generated|failed
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, scheduled_for)
);
CREATE INDEX IF NOT EXISTS idx_sub_orders_sched ON public.subscription_orders(scheduled_for);
ALTER TABLE public.subscription_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own sub orders" ON public.subscription_orders FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id = subscription_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Users update own sub orders" ON public.subscription_orders FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id = subscription_id AND s.user_id = auth.uid()));
CREATE POLICY "System inserts sub orders" ON public.subscription_orders FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id = subscription_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- Helper: compute next delivery date from frequency
CREATE OR REPLACE FUNCTION public.compute_next_delivery_date(_frequency text, _from date)
RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _frequency
    WHEN 'daily' THEN _from + INTERVAL '1 day'
    WHEN 'alternate' THEN _from + INTERVAL '2 days'
    WHEN 'weekly' THEN _from + INTERVAL '7 days'
    WHEN 'monthly' THEN _from + INTERVAL '1 month'
    ELSE _from + INTERVAL '1 day'
  END::date;
$$;

-- Seed a couple subscription plans tied to first product if any exist
INSERT INTO public.subscription_plans (title, description, frequency, product_id, default_quantity, discount_type, discount_value, popular, display_order)
SELECT 'Daily fresh', 'Fresh eggs delivered every morning', 'daily', p.id, 1, 'percent', 10, true, 1 FROM public.products p WHERE p.active LIMIT 1;
INSERT INTO public.subscription_plans (title, description, frequency, product_id, default_quantity, discount_type, discount_value, display_order)
SELECT 'Alternate days', 'Every other day. Perfect for couples.', 'alternate', p.id, 1, 'percent', 7, 2 FROM public.products p WHERE p.active LIMIT 1;
INSERT INTO public.subscription_plans (title, description, frequency, product_id, default_quantity, discount_type, discount_value, display_order)
SELECT 'Weekly stock-up', 'Top up your fridge every week', 'weekly', p.id, 2, 'percent', 5, 3 FROM public.products p WHERE p.active LIMIT 1;
