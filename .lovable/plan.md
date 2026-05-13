# Eggscellent — Professional D2C Overhaul Plan

A systemic upgrade across auth, identity binding, feature flagging, role provisioning, subscriptions, and payments. Preserves the existing warm Eggscellent design system (rounded cards, shadows, brown/yolk palette, shadcn/ui).

---

## 1. Unified Identity & JIT Binding Engine

**Auth refactor (`/auth`)**
- Remove all email/password forms and their submit handlers.
- Keep two tabs only: **Google** (via `lovable.auth.signInWithOAuth("google")`) and **Phone OTP** (existing mock flow via `phone-auth` edge function).
- On Google first-login, the existing `handle_new_user()` trigger already extracts `full_name` + `avatar_url` from `raw_user_meta_data` — no DB change needed.
- `Auth.tsx` simplified to two large provider buttons + phone OTP panel.

**Profile completeness model**
- Add `useProfileCompleteness()` hook that returns `{ profile, missing: 'phone' | 'email' | 'name' | null, isComplete }`.
- A profile is **Complete** only when `email`, `phone`, and `full_name` are all set.
- Used by Header (subtle "Verify phone" pill), Checkout (mandatory), and `/profile`.

**JIT Checkout Interceptor**
- Replace the existing `MissingIdentityDialog` with a richer **slide-over `Sheet`** (shadcn) that:
  - For Google users missing phone → shows phone input + 6-digit `InputOTP` verification using existing `phone-auth` function (`send` then `verify` actions). On verify, updates `profiles.phone`.
  - For Phone users missing email/name → shows email + name fields, writes to `profiles`, sends a mock email-confirm code (reuse OTP UI, no real send).
- Sheet is non-dismissible while items in cart and step ≥ payment; user cannot leave checkout page.
- Place-order button stays disabled until `isComplete === true`.

**Centralized Profile view (`/profile`)**
- New page (and a tab inside `/account`) showing:
  - Avatar + display name (editable), Google badge if linked, Phone badge if verified, Email badge if verified.
  - "Verify phone" / "Verify email" inline actions reusing the same JIT Sheet component.
  - **Address Book** — list of saved addresses with default selector, edit, delete (uses existing `addresses` table + `AddressPicker`).

---

## 2. Operational 'Ghost UI' (Feature Flagging)

**Admin master toggle**
- Reuse existing `app_settings` table. Add a `feature_flags` key with `{ instant_delivery_enabled: boolean, partners: [{name, logo_url, deep_link}] }`.
- Add a **Feature Flags** card on `/admin/settings` with a `Switch` for "Enable Instant Delivery Partners" and a small editor for partner entries (Swiggy, Blinkit, Zepto, etc.).

**Frontend consumption**
- New `useFeatureFlags()` hook (React Query, cached, auto-invalidated on mutation).
- New `<InstantDeliveryRail />` component rendered in `Hero` / `Products` area only when flag is ON.
- When OFF, the component returns `null` (true unmount, not `display:none`) so DOM is clean.
- To prevent layout shift: the rail lives in its own grid row with no reserved height; surrounding sections use `gap` not fixed margins. Verified at 1202px and mobile.

---

## 3. Staff Provisioning & Role-Based Navigation

**`app_role` enum** already has `admin`, `partner`, `customer` — no migration needed.

**Staff Management module (`/admin/staff`)**
- New admin page with an input (email or phone) + role selector (`admin` / `delivery_partner`) + Promote / Demote buttons.
- Resolves user via `profiles` lookup by email or phone, then inserts/deletes in `user_roles`.
- Lists current admins and partners with revoke buttons.
- Uses existing RLS (`Admins manage roles`).

**Role-aware Header**
- Extend `AuthContext` to also expose `isPartner` (already have a server function `is_active_partner`).
- Header dropdown gains a **"Staff Portal"** menu item that routes to `/admin` (for admins) or `/partner` (for partners). Hidden for customers. Styled as a subtle brown pill with a shield icon to feel "enterprise".

**Route guards**
- `RequireAuth` already supports `adminOnly`. Add a `partnerOnly` prop and a new `/partner` route guard.
- Unauthorized access → `/unauthorized` (already exists).
- Add a `usePartnerStatus()` hook backed by `is_active_partner` RPC for the guard.

---

## 4. Advanced Logistics & Subscriptions

**Subscription frequency UI**
- `subscription_plans.frequency` already supports `daily | alternate | weekly | monthly`.
- Update plan cards on the public `/subscribe` (or product detail) to show three pill toggles: **Daily / Alternate / Weekly**.
- Each card shows a clear comparison block:
  - `One-time price: ₹X`
  - `Subscriber price: ₹Y` (computed from `discount_value` + `discount_type`)
  - `You save ₹(X−Y) per delivery` (success-colored badge)
- Admin `/admin/subscriptions` already supports CRUD; ensure frequency dropdown lists all three.

**Partner Dashboard upgrades (`/partner`)**
- Compact order cards (rounded-2xl, shadow-soft) showing: order #, slot, customer name, address one-liner, item count, total.
- Primary action: **Navigate to Customer** button — opens `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>` (falls back to URL-encoded address string when lat/lng unavailable).
- Status-advance buttons (`packed → out_for_delivery → delivered`) calling existing `partner_update_order_status` RPC.
- Realtime refresh via `supabase.channel` on `orders` filtered by `delivery_partner_id`.

**Schema additions** (single small migration)
- `addresses.lat numeric`, `addresses.lng numeric` (nullable) — populated by Google Maps picker when available.
- `orders.lat numeric`, `orders.lng numeric` (nullable) — copied from address at order time.

---

## 5. Technical Skeleton

**Razorpay scaffold**
- `src/lib/payments/razorpay.ts` — typed service with `createOrder(amount)`, `openCheckout(order, onSuccess, onFailure)`. For now, both methods simulate: 1.5s `setTimeout` returning a fake `payment_id`.
- `src/components/checkout/RazorpayButton.tsx` — branded button using design tokens, shows spinner during the simulated 1.5s.
- Wired into Checkout payment options as a third method ("Pay online (demo)") next to UPI / COD; on success marks `payment_status='paid'` and proceeds.
- Provider-agnostic shape so swapping in a real key later is a one-file change.

**State integrity**
- All role / flag / profile mutations call `queryClient.invalidateQueries` for the affected keys.
- `AuthContext` re-resolves role on `onAuthStateChange` (already does) AND exposes a `refreshRole()` function admins can call after promote/demote so their own UI updates without refresh.
- `useFeatureFlags`, `useProfileCompleteness`, `usePartnerStatus` all use React Query with `staleTime: 0` for admin-mutable data and Supabase realtime for `app_settings` + `user_roles` to push changes to other tabs immediately.

---

## Files

**New**
```
src/hooks/useProfileCompleteness.ts
src/hooks/useFeatureFlags.ts
src/hooks/usePartnerStatus.ts
src/components/site/JitVerifySheet.tsx           // replaces MissingIdentityDialog
src/components/site/InstantDeliveryRail.tsx
src/components/site/StaffPortalLink.tsx
src/components/admin/FeatureFlagsCard.tsx
src/components/checkout/RazorpayButton.tsx
src/lib/payments/razorpay.ts
src/pages/Profile.tsx
src/pages/Partner.tsx                             // partner dashboard
src/pages/admin/AdminStaff.tsx
supabase/migrations/<ts>_address_geo.sql          // lat/lng cols + feature_flags seed row
```

**Edited**
```
src/App.tsx                  // add /profile, /partner, /admin/staff routes; partnerOnly guard
src/components/RequireAuth.tsx
src/context/AuthContext.tsx  // add isPartner, refreshRole()
src/components/site/Header.tsx // Staff Portal entry
src/pages/Auth.tsx            // remove email/password, keep Google + phone
src/pages/Checkout.tsx        // swap dialog for JitVerifySheet + Razorpay option
src/pages/admin/AdminLayout.tsx // sidebar entries (Staff, Feature Flags shown via Settings)
src/pages/admin/AdminSettings.tsx // mount FeatureFlagsCard
src/pages/Index.tsx           // mount <InstantDeliveryRail/>
```

**Removed**
```
src/components/site/MissingIdentityDialog.tsx (replaced)
```

---

## Migration (single file)

```sql
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS lat numeric;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS lng numeric;
ALTER TABLE public.orders    ADD COLUMN IF NOT EXISTS lat numeric;
ALTER TABLE public.orders    ADD COLUMN IF NOT EXISTS lng numeric;

INSERT INTO public.app_settings(key, value)
VALUES ('feature_flags', '{"instant_delivery_enabled": false, "partners": []}'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
```

No RLS changes required — existing policies already cover all new flows.

---

## Out of scope (explicit)

- Real Razorpay keys / live payments (scaffold only, simulated success).
- Real SMS gateway (mock OTP retained).
- Real Google Maps Places billing setup (provider layer already exists).
- Visual redesign — all new UI uses existing tokens (`brown`, `primary`, `gradient-yolk`, `shadow-soft`, `rounded-3xl`).

Reply **go** to implement, or tell me what to adjust.