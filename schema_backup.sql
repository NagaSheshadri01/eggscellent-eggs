-- Supabase Schema Dump
-- Generated from JSON Backup

CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  address_line_1 text NOT NULL,
  address_line_2 text,
  city text NOT NULL,
  state text NOT NULL,
  pincode text NOT NULL,
  landmark text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  label text,
  lat numeric,
  lng numeric,
  email text,
  address_name text,
  address_phone text,
  area_locality text,
  address_tag text DEFAULT 'Home'::text,
  is_deleted boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text NOT NULL,
  value text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cms_content (
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.content_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text,
  subtitle text,
  description text,
  image_url text,
  metadata jsonb,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  description text,
  discount_type USER-DEFINED NOT NULL,
  discount_value numeric NOT NULL,
  min_order_amount numeric DEFAULT 0,
  expiry timestamp with time zone,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  usage_limit integer DEFAULT 500,
  used_count integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.delivery_config (
  id integer NOT NULL DEFAULT 1,
  store_latitude numeric NOT NULL DEFAULT 17.5011000,
  store_longitude numeric NOT NULL DEFAULT 78.5020000,
  min_order_value numeric DEFAULT 150.00,
  delivery_tiers jsonb DEFAULT '[{"price": 30, "to_km": 3, "from_km": 0}, {"price": 50, "to_km": 7, "from_km": 3}, {"price": 0, "to_km": 15, "from_km": 7}]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.delivery_ledger (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid,
  delivery_date date NOT NULL,
  product_slug text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  effective_price numeric NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'::text,
  delivery_partner_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  custom_order_id text,
  master_order_id uuid,
  user_id uuid
);

CREATE TABLE IF NOT EXISTS public.delivery_partners (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  vehicle_type text,
  city text,
  pincode text,
  availability jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'::text,
  active boolean NOT NULL DEFAULT false,
  aadhaar_url text,
  license_url text,
  experience_years integer,
  assigned_areas ARRAY NOT NULL DEFAULT '{}'::text[],
  assigned_slot_ids ARRAY NOT NULL DEFAULT '{}'::uuid[],
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_pricing_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  max_distance_km numeric NOT NULL,
  delivery_fee numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  label text NOT NULL,
  start_time time without time zone,
  end_time time without time zone,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  tag text DEFAULT 'one_time'::text,
  slot_key text,
  cutoff_time time without time zone,
  is_active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.faq (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.master_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  custom_order_id text NOT NULL,
  user_id uuid NOT NULL,
  delivery_date date NOT NULL,
  delivery_partner_id uuid,
  status text NOT NULL DEFAULT 'scheduled'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.offers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  offer_type text NOT NULL DEFAULT 'product_discount'::text,
  min_order_value numeric DEFAULT 0.00,
  required_product_slugs ARRAY,
  reward_product_slug text,
  coupon_code_to_apply text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  product_id uuid,
  product_name text NOT NULL,
  product_image text,
  unit text,
  quantity integer NOT NULL,
  price numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  address_id uuid,
  address_snapshot jsonb,
  subtotal numeric NOT NULL,
  delivery_fee numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL,
  payment_method USER-DEFINED NOT NULL DEFAULT 'cod'::payment_method,
  payment_status USER-DEFINED NOT NULL DEFAULT 'pending'::payment_status,
  order_status USER-DEFINED NOT NULL DEFAULT 'placed'::order_status,
  delivery_slot text,
  coupon_code text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  slot_id text,
  delivery_partner_id uuid,
  picked_up_at timestamp with time zone,
  out_for_delivery_at timestamp with time zone,
  delivered_at timestamp with time zone,
  pincode text,
  lat numeric,
  lng numeric,
  scheduled_date date,
  custom_order_id text
);

CREATE TABLE IF NOT EXISTS public.phone_otps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  category text,
  unit text,
  benefit text,
  image_url text,
  images ARRAY NOT NULL DEFAULT '{}'::text[],
  original_price numeric NOT NULL,
  discounted_price numeric NOT NULL,
  stock_quantity integer NOT NULL DEFAULT 0,
  tags ARRAY NOT NULL DEFAULT '{}'::text[],
  nutrition_info jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  display_order integer NOT NULL DEFAULT 0,
  parent_group_id text,
  out_of_stock_one_time boolean DEFAULT false,
  out_of_stock_subscriptions boolean DEFAULT false,
  stock_one_time integer DEFAULT 100,
  stock_subscriptions integer DEFAULT 100
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_vip boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.serviceable_pincodes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pincode text NOT NULL,
  area_name text,
  active boolean NOT NULL DEFAULT true,
  delivery_fee_override numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_settings (
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  product_slug text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  frequency_type text NOT NULL,
  custom_days ARRAY,
  price_per_delivery numeric NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  max_deliveries_per_week integer NOT NULL DEFAULT 1,
  is_vip_eligible boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  product_slug text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  selected_days ARRAY NOT NULL,
  address_id uuid,
  status text NOT NULL DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  frequency text,
  start_date date DEFAULT CURRENT_DATE,
  next_delivery_date date,
  end_date date,
  slot_id text,
  payment_method text DEFAULT 'cod'::text,
  product_id uuid,
  plan_id uuid,
  is_vip boolean DEFAULT false,
  wallet_mode boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  notification_type text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role USER-DEFINED NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL,
  amount numeric NOT NULL,
  transaction_type text NOT NULL,
  reference_id text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  balance numeric NOT NULL DEFAULT 0.00,
  updated_at timestamp with time zone DEFAULT now()
);

-- CONSTRAINTS --

ALTER TABLE public.delivery_ledger ADD CONSTRAINT delivery_ledger_product_slug_fkey FOREIGN KEY (product_slug) REFERENCES products(slug) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.delivery_ledger ADD CONSTRAINT delivery_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.addresses ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);
ALTER TABLE public.addresses ADD CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.products ADD CONSTRAINT products_pkey PRIMARY KEY (id);
ALTER TABLE public.products ADD CONSTRAINT products_slug_key UNIQUE (slug);
ALTER TABLE public.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
ALTER TABLE public.orders ADD CONSTRAINT orders_address_id_fkey FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);
ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE public.faq ADD CONSTRAINT faq_pkey PRIMARY KEY (id);
ALTER TABLE public.content_blocks ADD CONSTRAINT content_blocks_pkey PRIMARY KEY (id);
ALTER TABLE public.coupons ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);
ALTER TABLE public.coupons ADD CONSTRAINT coupons_code_key UNIQUE (code);
ALTER TABLE public.phone_otps ADD CONSTRAINT phone_otps_pkey PRIMARY KEY (id);
ALTER TABLE public.cms_content ADD CONSTRAINT site_content_pkey PRIMARY KEY (key);
ALTER TABLE public.site_settings ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);
ALTER TABLE public.serviceable_pincodes ADD CONSTRAINT serviceable_pincodes_pkey PRIMARY KEY (id);
ALTER TABLE public.serviceable_pincodes ADD CONSTRAINT serviceable_pincodes_pincode_key UNIQUE (pincode);
ALTER TABLE public.delivery_slots ADD CONSTRAINT delivery_slots_pkey PRIMARY KEY (id);
ALTER TABLE public.delivery_partners ADD CONSTRAINT delivery_partners_pkey PRIMARY KEY (id);
ALTER TABLE public.delivery_partners ADD CONSTRAINT delivery_partners_phone_key UNIQUE (phone);
ALTER TABLE public.delivery_partners ADD CONSTRAINT delivery_partners_user_id_key UNIQUE (user_id);
ALTER TABLE public.delivery_partners ADD CONSTRAINT unique_partner_user_id UNIQUE (user_id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);
ALTER TABLE public.orders ADD CONSTRAINT orders_final_logistics_fkey FOREIGN KEY (delivery_partner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.offers ADD CONSTRAINT offers_pkey PRIMARY KEY (id);
ALTER TABLE public.delivery_slots ADD CONSTRAINT delivery_slots_slot_key_key UNIQUE (slot_key);
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_address_id_fkey FOREIGN KEY (address_id) REFERENCES addresses(id);
ALTER TABLE public.orders ADD CONSTRAINT orders_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES delivery_slots(slot_key);
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES delivery_slots(slot_key);
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL;
ALTER TABLE public.subscription_plans ADD CONSTRAINT check_frequency_type CHECK ((frequency_type = ANY (ARRAY['daily'::text, 'alternate'::text, 'weekly'::text, 'custom_days'::text])));
ALTER TABLE public.wallets ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);
ALTER TABLE public.wallets ADD CONSTRAINT wallets_user_id_key UNIQUE (user_id);
ALTER TABLE public.wallets ADD CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.delivery_ledger ADD CONSTRAINT delivery_ledger_master_order_id_fkey FOREIGN KEY (master_order_id) REFERENCES master_orders(id) ON DELETE CASCADE;
ALTER TABLE public.master_orders ADD CONSTRAINT master_orders_delivery_partner_id_fkey FOREIGN KEY (delivery_partner_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.delivery_config ADD CONSTRAINT single_row_lock CHECK ((id = 1));
ALTER TABLE public.delivery_config ADD CONSTRAINT delivery_config_pkey PRIMARY KEY (id);
ALTER TABLE public.delivery_pricing_tiers ADD CONSTRAINT delivery_pricing_tiers_pkey PRIMARY KEY (id);
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['recharge'::text, 'delivery_deduction'::text, 'refund'::text, 'admin_adjustment'::text, 'compensation'::text])));
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE;
ALTER TABLE public.delivery_ledger ADD CONSTRAINT delivery_ledger_pkey PRIMARY KEY (id);
ALTER TABLE public.delivery_ledger ADD CONSTRAINT delivery_ledger_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE;
ALTER TABLE public.delivery_ledger ADD CONSTRAINT delivery_ledger_delivery_partner_id_fkey FOREIGN KEY (delivery_partner_id) REFERENCES profiles(id);
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_pkey1 PRIMARY KEY (key);
ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.delivery_ledger ADD CONSTRAINT unique_sub_date_product UNIQUE (subscription_id, delivery_date, product_slug);
ALTER TABLE public.wallets ADD CONSTRAINT chk_wallet_balance_non_negative CHECK ((balance >= '-500.00'::numeric));
ALTER TABLE public.orders ADD CONSTRAINT orders_custom_order_id_key UNIQUE (custom_order_id);
ALTER TABLE public.delivery_ledger ADD CONSTRAINT check_delivery_ledger_status CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'out_for_delivery'::text, 'delivered'::text, 'out_of_stock'::text, 'on_hold'::text, 'scheduled'::text, 'failed'::text, 'skipped'::text, 'cancelled'::text, 'paused'::text, 'pending_payment'::text])));
ALTER TABLE public.orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.master_orders ADD CONSTRAINT master_orders_pkey PRIMARY KEY (id);
ALTER TABLE public.master_orders ADD CONSTRAINT master_orders_custom_order_id_key UNIQUE (custom_order_id);
ALTER TABLE public.master_orders ADD CONSTRAINT unique_customer_delivery_date UNIQUE (user_id, delivery_date);
ALTER TABLE public.master_orders ADD CONSTRAINT master_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- INDEXES --

CREATE UNIQUE INDEX delivery_pricing_tiers_pkey ON public.delivery_pricing_tiers USING btree (id);
CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);
CREATE UNIQUE INDEX profiles_phone_unique ON public.profiles USING btree (phone) WHERE (phone IS NOT NULL);
CREATE UNIQUE INDEX profiles_email_unique ON public.profiles USING btree (lower(email)) WHERE (email IS NOT NULL);
CREATE INDEX idx_profiles_phone ON public.profiles USING btree (phone) WHERE (phone IS NOT NULL);
CREATE INDEX idx_profiles_email ON public.profiles USING btree (lower(email)) WHERE (email IS NOT NULL);
CREATE UNIQUE INDEX products_pkey ON public.products USING btree (id);
CREATE UNIQUE INDEX products_slug_key ON public.products USING btree (slug);
CREATE INDEX idx_products_active ON public.products USING btree (active);
CREATE INDEX idx_products_display_order ON public.products USING btree (display_order);
CREATE UNIQUE INDEX order_items_pkey ON public.order_items USING btree (id);
CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);
CREATE UNIQUE INDEX faq_pkey ON public.faq USING btree (id);
CREATE UNIQUE INDEX phone_otps_pkey ON public.phone_otps USING btree (id);
CREATE INDEX phone_otps_phone_idx ON public.phone_otps USING btree (phone);
CREATE UNIQUE INDEX content_blocks_pkey ON public.content_blocks USING btree (id);
CREATE INDEX idx_content_type ON public.content_blocks USING btree (type);
CREATE UNIQUE INDEX serviceable_pincodes_pkey ON public.serviceable_pincodes USING btree (id);
CREATE UNIQUE INDEX serviceable_pincodes_pincode_key ON public.serviceable_pincodes USING btree (pincode);
CREATE INDEX idx_serviceable_pincodes_pin ON public.serviceable_pincodes USING btree (pincode);
CREATE UNIQUE INDEX delivery_slots_pkey ON public.delivery_slots USING btree (id);
CREATE UNIQUE INDEX delivery_slots_slot_key_key ON public.delivery_slots USING btree (slot_key);
CREATE INDEX idx_orders_partner ON public.orders USING btree (delivery_partner_id);
CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id);
CREATE INDEX idx_orders_user ON public.orders USING btree (user_id);
CREATE INDEX idx_orders_status ON public.orders USING btree (order_status);
CREATE INDEX idx_orders_user_created ON public.orders USING btree (user_id, created_at DESC);
CREATE INDEX idx_orders_pincode ON public.orders USING btree (pincode);
CREATE INDEX idx_orders_slot ON public.orders USING btree (slot_id);
CREATE UNIQUE INDEX orders_custom_order_id_key ON public.orders USING btree (custom_order_id);
CREATE UNIQUE INDEX delivery_partners_pkey ON public.delivery_partners USING btree (id);
CREATE UNIQUE INDEX delivery_partners_phone_key ON public.delivery_partners USING btree (phone);
CREATE INDEX idx_partners_user ON public.delivery_partners USING btree (user_id);
CREATE INDEX idx_partners_status ON public.delivery_partners USING btree (status);
CREATE UNIQUE INDEX delivery_partners_user_id_key ON public.delivery_partners USING btree (user_id);
CREATE UNIQUE INDEX unique_partner_user_id ON public.delivery_partners USING btree (user_id);
CREATE INDEX idx_addresses_is_deleted ON public.addresses USING btree (is_deleted);
CREATE UNIQUE INDEX addresses_pkey ON public.addresses USING btree (id);
CREATE INDEX idx_addresses_user ON public.addresses USING btree (user_id);
CREATE UNIQUE INDEX site_content_pkey ON public.cms_content USING btree (key);
CREATE UNIQUE INDEX app_settings_pkey ON public.site_settings USING btree (key);
CREATE UNIQUE INDEX coupons_pkey ON public.coupons USING btree (id);
CREATE UNIQUE INDEX coupons_code_key ON public.coupons USING btree (code);
CREATE UNIQUE INDEX offers_pkey ON public.offers USING btree (id);
CREATE UNIQUE INDEX delivery_config_pkey ON public.delivery_config USING btree (id);
CREATE UNIQUE INDEX user_roles_pkey ON public.user_roles USING btree (id);
CREATE UNIQUE INDEX user_roles_user_id_key ON public.user_roles USING btree (user_id);
CREATE UNIQUE INDEX subscriptions_pkey ON public.subscriptions USING btree (id);
CREATE UNIQUE INDEX idx_unique_active_user_sub_slug ON public.subscriptions USING btree (user_id, product_slug) WHERE (status = ANY (ARRAY['active'::text, 'paused'::text]));
CREATE UNIQUE INDEX subscription_plans_pkey ON public.subscription_plans USING btree (id);
CREATE UNIQUE INDEX wallet_transactions_pkey ON public.wallet_transactions USING btree (id);
CREATE UNIQUE INDEX delivery_ledger_pkey ON public.delivery_ledger USING btree (id);
CREATE UNIQUE INDEX unique_sub_date_product ON public.delivery_ledger USING btree (subscription_id, delivery_date, product_slug);
CREATE INDEX idx_delivery_ledger_shared_box_id ON public.delivery_ledger USING btree (custom_order_id);
CREATE UNIQUE INDEX app_settings_pkey1 ON public.app_settings USING btree (key);
CREATE UNIQUE INDEX user_notifications_pkey ON public.user_notifications USING btree (id);
CREATE UNIQUE INDEX wallets_pkey ON public.wallets USING btree (id);
CREATE UNIQUE INDEX wallets_user_id_key ON public.wallets USING btree (user_id);
CREATE UNIQUE INDEX master_orders_pkey ON public.master_orders USING btree (id);
CREATE UNIQUE INDEX master_orders_custom_order_id_key ON public.master_orders USING btree (custom_order_id);
CREATE UNIQUE INDEX unique_customer_delivery_date ON public.master_orders USING btree (user_id, delivery_date);
CREATE INDEX idx_master_orders_lookup ON public.master_orders USING btree (delivery_date, delivery_partner_id);
