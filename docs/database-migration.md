# Eggscellent — Full Database Migration Reference

This document contains the complete SQL needed to recreate the backend (schema, enums, RLS, triggers, functions, seed admins) on a fresh Lovable Cloud / Supabase project. Run sections in order.

---

## 1. Extensions

```sql
create extension if not exists "pgcrypto";
```

## 2. Enums

```sql
create type public.app_role        as enum ('admin', 'customer');
create type public.order_status    as enum ('placed','confirmed','packed','out_for_delivery','delivered','cancelled');
create type public.payment_status  as enum ('pending','paid','failed','refunded');
create type public.payment_method  as enum ('cod','upi','card');
create type public.discount_type   as enum ('flat','percent');
```

## 3. Shared helpers

```sql
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
```

## 4. Tables

### profiles
```sql
create table public.profiles (
  id uuid primary key,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
```

### user_roles
```sql
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;
```

### addresses
```sql
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  full_name text not null,
  phone text not null,
  address_line_1 text not null,
  address_line_2 text,
  city text not null,
  state text not null,
  pincode text not null,
  landmark text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.addresses enable row level security;
```

### products
```sql
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  category text,
  unit text,
  benefit text,
  image_url text,
  images text[] not null default '{}',
  tags text[] not null default '{}',
  original_price numeric not null,
  discounted_price numeric not null,
  stock_quantity int not null default 0,
  nutrition_info jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;
```

### orders + order_items
```sql
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  address_id uuid,
  address_snapshot jsonb,
  subtotal numeric not null,
  discount numeric not null default 0,
  delivery_fee numeric not null default 0,
  total numeric not null,
  payment_method public.payment_method not null default 'cod',
  payment_status public.payment_status not null default 'pending',
  order_status public.order_status not null default 'placed',
  delivery_slot text,
  coupon_code text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.orders enable row level security;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  product_id uuid,
  product_name text not null,
  product_image text,
  unit text,
  quantity int not null,
  price numeric not null,
  created_at timestamptz not null default now()
);
alter table public.order_items enable row level security;
```

### coupons / faq / content_blocks
```sql
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type public.discount_type not null,
  discount_value numeric not null,
  min_order_amount numeric default 0,
  expiry timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.coupons enable row level security;

create table public.faq (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category text,
  display_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.faq enable row level security;

create table public.content_blocks (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text,
  subtitle text,
  description text,
  image_url text,
  metadata jsonb,
  display_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.content_blocks enable row level security;
```

## 5. updated_at triggers

```sql
create trigger trg_profiles_updated  before update on public.profiles       for each row execute function public.update_updated_at_column();
create trigger trg_addresses_updated before update on public.addresses      for each row execute function public.update_updated_at_column();
create trigger trg_products_updated  before update on public.products       for each row execute function public.update_updated_at_column();
create trigger trg_orders_updated    before update on public.orders         for each row execute function public.update_updated_at_column();
create trigger trg_coupons_updated   before update on public.coupons        for each row execute function public.update_updated_at_column();
create trigger trg_faq_updated       before update on public.faq            for each row execute function public.update_updated_at_column();
create trigger trg_content_updated   before update on public.content_blocks for each row execute function public.update_updated_at_column();
```

## 6. New-user trigger (auto profile + customer role)

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.email,
    new.phone,
    new.raw_user_meta_data->>'avatar_url'
  );
  insert into public.user_roles (user_id, role) values (new.id, 'customer')
    on conflict do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

## 7. Row-Level Security policies

```sql
-- profiles
create policy "Profiles viewable by self or admin" on public.profiles
  for select using (auth.uid() = id or public.has_role(auth.uid(),'admin'));
create policy "Users insert own profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id);

-- user_roles
create policy "Users see own roles" on public.user_roles
  for select using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "Admins manage roles" on public.user_roles
  for all using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- addresses
create policy "Users manage own addresses" on public.addresses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Admins view all addresses" on public.addresses
  for select using (public.has_role(auth.uid(),'admin'));

-- products
create policy "Active products are public" on public.products
  for select using (active = true or public.has_role(auth.uid(),'admin'));
create policy "Admins manage products" on public.products
  for all using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- orders
create policy "Users see own orders" on public.orders
  for select using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "Users create own orders" on public.orders
  for insert with check (auth.uid() = user_id);
create policy "Admins update orders" on public.orders
  for update using (public.has_role(auth.uid(),'admin'));

-- order_items
create policy "Users see own order items" on public.order_items
  for select using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (o.user_id = auth.uid() or public.has_role(auth.uid(),'admin'))
  ));
create policy "Users insert own order items" on public.order_items
  for insert with check (exists (
    select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid()
  ));

-- coupons
create policy "Active coupons readable by authenticated" on public.coupons
  for select using (active = true and auth.uid() is not null);
create policy "Admins manage coupons" on public.coupons
  for all using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- faq
create policy "FAQ public read" on public.faq
  for select using (active = true or public.has_role(auth.uid(),'admin'));
create policy "Admins manage FAQ" on public.faq
  for all using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- content_blocks
create policy "Content public read" on public.content_blocks
  for select using (active = true or public.has_role(auth.uid(),'admin'));
create policy "Admins manage content" on public.content_blocks
  for all using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));
```

## 8. Promote admins (re-runnable)

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users
where email in ('nagasheshadrikalli@gmail.com','nagasheshadri001@gmail.com')
on conflict do nothing;
```

## 9. Auth configuration (dashboard)

- Enable Email + Google providers.
- Site URL = preview URL; add published + custom domain to redirect URLs.
- Email auto-confirm: OFF (users verify email).

## 10. Verification queries

```sql
select email, r.role
from auth.users u join public.user_roles r on r.user_id = u.id
order by u.created_at desc;

select count(*) from public.products where active;
```
