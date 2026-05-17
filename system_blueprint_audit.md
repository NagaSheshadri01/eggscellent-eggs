# 🥚 Eggscellent — System Blueprint & Logic Audit

**Role:** Lead Systems Architect  
**Date:** 2026-05-13  
**Codebase:** `e:\eggscellent-eggs` (Vite + React + TypeScript + Supabase)

---

## 1. Directory & Component Map

### High-Level File Structure

```
eggscellent-eggs/
├── src/
│   ├── App.tsx                  # Root: providers + React Router route tree
│   ├── main.tsx                 # Vite entry point
│   ├── index.css                # Global CSS / design tokens (Tailwind)
│   ├── context/
│   │   ├── AuthContext.tsx      # Global auth state, role resolution, realtime wiring
│   │   └── CartContext.tsx      # Cart state (localStorage-persisted)
│   ├── components/
│   │   ├── RequireAuth.tsx      # Route guard (adminOnly, partnerOnly variants)
│   │   ├── Seo.tsx              # Helmet-style SEO meta injector
│   │   ├── NavLink.tsx          # Styled router link
│   │   ├── site/               # Customer-facing UI components (19 files)
│   │   ├── checkout/           # Razorpay scaffold (2 files — mostly unused)
│   │   ├── admin/              # ImageUploader (for Admin product forms)
│   │   └── ui/                 # shadcn/ui primitives (button, input, sheet, etc.)
│   ├── hooks/                  # 13 data-fetching hooks (React Query wrappers)
│   ├── pages/
│   │   ├── Index.tsx           # Homepage (assembles all site/ sections)
│   │   ├── Auth.tsx            # Phone OTP login page
│   │   ├── Checkout.tsx        # Full checkout flow (address → slot → payment)
│   │   ├── Profile.tsx         # User profile + address manager
│   │   ├── Account.tsx         # Orders + address tabs
│   │   ├── Partner.tsx         # Delivery partner portal
│   │   ├── Orders.tsx / OrderDetail.tsx
│   │   └── admin/              # 14 admin pages
│   ├── lib/
│   │   ├── services/user.service.ts    # Profile CRUD + synthetic-email helpers
│   │   ├── payments/razorpay.ts        # Razorpay scaffold (demo simulation)
│   │   ├── payments/payment.service.ts # Provider-agnostic facade
│   │   └── mockOtp.ts                  # (stub — not actively used)
│   └── integrations/supabase/          # Auto-generated Supabase client + types
├── supabase/
│   ├── functions/phone-auth/index.ts   # Deno edge function — OTP engine
│   └── migrations/                     # 10 ordered SQL migration files
└── public/                             # Static assets
```

### Core Layout Components & Global UI State

| Component | File | Responsibility |
|---|---|---|
| `AuthProvider` | `context/AuthContext.tsx` | Session, `isAdmin`, `roleLoading`, realtime role/profile channels |
| `CartProvider` | `context/CartContext.tsx` | Cart items (localStorage), `open` drawer state |
| `Header` | `components/site/Header.tsx` | Sticky nav bar; renders `StaffPortalLink` + user dropdown |
| `StaffPortalLink` | `components/site/StaffPortalLink.tsx` | Shows **Admin Portal** or **Partner Portal** button iff `isAdmin` or `isPartner` |
| `CartDrawer` | `components/site/CartDrawer.tsx` | Slide-in cart, rendered at root level (in `App.tsx`) so it persists across routes |
| `RequireAuth` | `components/RequireAuth.tsx` | Protects routes; blocks on `loading` + `roleLoading` before deciding access |

**"Staff Portal" button logic:** `StaffPortalLink` calls `useAuth()` for `isAdmin` and `usePartnerStatus()` for the partner flag. Both resolve asynchronously — the button simply renders `null` until both are ready. It is conditionally displayed, never hidden via CSS, so there is no "Ghost UI toggle" as such; the logic is pure data-driven rendering.

---

## 2. Identity & Auth Wireframe

### 2a. Phone OTP Authentication Flow

```
User types phone → Auth.tsx (sendCode)
  │
  ▼
supabase.functions.invoke("phone-auth", { action: "send-otp", phone })
  │   [Edge Function: phone-auth/index.ts]
  │   1. Normalizes phone
  │   2. Invalidates previous unused OTPs for this phone
  │   3. Inserts { phone, code, expires_at: +5 min } into phone_otps table
  │   4. Returns { ok: true, devCode: code }  ← OTP shown on screen (DEMO MODE)
  │
  ▼
Auth.tsx shows InputOTP (6-digit)
User enters code → handleVerify()
  │
  ▼
supabase.functions.invoke("phone-auth", { action: "verify-otp", phone, code })
  │   [Edge Function]
  │   1. Fetches latest phone_otps row for this phone
  │   2. Validates: code match + not expired (used flag is NOT checked — idempotent)
  │   3. Marks OTP as used
  │   4. Finds existing user by phone in profiles table
  │      ├── Found: updates password to ephemeral UUID, signs in
  │      └── Not found: creates auth.users with synthetic email
  │              (phone@auth.eggscellent.app), clears profile.email = NULL
  │   5. Signs in via signInWithPassword (using real or synthetic email + temp password)
  │   6. Returns { ok, access_token, refresh_token }
  │
  ▼
Auth.tsx calls supabase.auth.setSession({ access_token, refresh_token })
  ▼
supabase.auth.refreshSession()  ← extra refresh to ensure profile writes are visible
  ▼
wait(500ms)  ← brief pause before redirect
  ▼
AuthContext.onAuthStateChange fires → setSession → resolveRole() → resolveRoleNow(uid)
  ▼
User redirected to `next` param (e.g., "/")
```

> [!IMPORTANT]
> The `used` flag on OTPs is set but **not checked during verification** (by design, to handle gateway retries). The security boundary is: correct 6-digit code + not expired. This is acceptable for demo mode but should be revisited for production.

### 2b. JIT (Just-In-Time) Identity Binding

The checkout page checks profile completeness **before** the order is placed:

```
Checkout.tsx mounts
  │
  ▼
useProfileCompleteness() → userService.ensureProfile(user)
  │   • Fetches profiles row for user.id
  │   • If missing → upserts a blank profile (no-op for phone-auth users)
  │   • Returns ProfileRow { full_name, email, phone }
  │
  ▼
Completeness logic (in useProfileCompleteness.ts):
  hasPhone = !!profile.phone
  hasEmail = !!profile.email && !isSyntheticEmail(profile.email)
  hasName  = !!profile.full_name?.trim()
  missing  = first of [phone, email, name] that is falsy
  isComplete = hasPhone && hasEmail && hasName
  │
  ▼
If !isComplete → JitVerifySheet opens automatically (blocking=true)
  │
  ├── missing === "phone"  → OTP verify flow (calls phone-auth edge fn with linkToUserId)
  │     Edge fn Mode A: links phone to existing account, updates profiles.phone
  ├── missing === "email"  → simple Input → userService.updateProfile({ email })
  │     (checks email_exists RPC first to prevent duplicates)
  └── missing === "name"   → simple Input → userService.updateProfile({ full_name })
  │
  ▼
onComplete() → invalidateProfile() → React Query re-fetches profile
  ▼
isComplete becomes true → placeOrder() proceeds
```

**Service that handles the DB update:** `userService` in `src/lib/services/user.service.ts`. It calls `supabase.from("profiles").upsert(...)` directly. Phone updates go via the edge function (Mode A).

### 2c. User Roles — Fetch & Cache

| Layer | Mechanism |
|---|---|
| **DB trigger** | `on_auth_user_created` → `handle_new_user()` — inserts `customer` role on every new auth.users row |
| **Auto-admin** | `auto_grant_admin_trigger` on `profiles` → grants `admin` role if email is in hardcoded whitelist |
| **Frontend fetch** | `AuthContext.resolveRoleNow(uid)` — single `.maybeSingle()` query on `user_roles` filtered by `role = 'admin'` |
| **Cache** | In-memory React state (`isAdmin`). Not React Query — no TTL. Lives as long as `AuthProvider` is mounted. |
| **Realtime update** | `AuthContext` subscribes to `postgres_changes` on `user_roles` (filtered by `user_id`). On any change → `refreshSession()` + `resolveRoleNow()`. This is how promoting a user via Admin panel instantly updates their UI. |
| **Partner role** | `usePartnerStatus` hook — React Query with realtime channel. Checks `delivery_partners` table (status=approved, active=true) OR `user_roles` for `partner` role. |

> [!NOTE]
> The `app_role` enum only contains `customer` and `admin`. The "partner" role concept is checked by looking at the `delivery_partners` table directly, not via `user_roles`. The `usePartnerStatus` hook also queries `user_roles` for a `partner` value — but this role can never be inserted since the enum doesn't include it. That half of the check is a **dead code path**.

---

## 3. Database & Real-time Synchronization

### 3a. All Supabase Tables & Relationships

```
auth.users (Supabase managed)
  │
  ├──[1:1]── profiles (id → auth.users.id)
  │            • full_name, email (nullable, synthetic masked), phone, avatar_url
  │            • UNIQUE INDEX on phone (WHERE NOT NULL)
  │            • UNIQUE INDEX on lower(email) (WHERE NOT NULL)
  │
  ├──[1:N]── user_roles (user_id → auth.users.id)
  │            • role: ENUM('customer','admin')
  │
  ├──[1:N]── addresses (user_id → auth.users.id)
  │            • full_name, phone, address lines, city, state, pincode, label, is_default
  │            • lat, lng (added migration 9)
  │
  ├──[1:N]── orders (user_id → auth.users.id)
  │            │  address_id → addresses.id (SET NULL on delete)
  │            │  slot_id → delivery_slots.id
  │            │  delivery_partner_id → delivery_partners.id
  │            │  address_snapshot (JSONB snapshot at order time)
  │            │  subtotal, delivery_fee, discount, total
  │            │  payment_method ENUM('upi','cod','card')
  │            │  payment_status ENUM('pending','paid','failed','refunded')
  │            │  order_status ENUM('placed','confirmed','packed','out_for_delivery','delivered','cancelled')
  │            │  lat, lng, pincode, coupon_code
  │            │
  │            └──[1:N]── order_items (order_id → orders.id CASCADE)
  │                         product_id → products.id (SET NULL on delete)
  │                         product_name, product_image, unit (snapshot)
  │                         quantity, price
  │
  ├──[1:N]── subscriptions (user_id → auth.users.id)
  │            │  plan_id → subscription_plans.id (nullable)
  │            │  product_id → products.id
  │            │  address_id → addresses.id
  │            │  slot_id → delivery_slots.id
  │            │  frequency: daily|alternate|weekly
  │            │  status: active|paused|cancelled
  │            │  next_delivery_date (date)
  │            │
  │            └──[1:N]── subscription_orders (subscription_id CASCADE)
  │                         order_id → orders.id (nullable — links generated orders)
  │                         scheduled_for (date), status: scheduled|skipped|generated|failed
  │                         UNIQUE (subscription_id, scheduled_for)
  │
  └──[1:1]── delivery_partners (user_id → auth.users.id, nullable)
               • phone, email, vehicle_type, city, pincode
               • status: pending|approved|rejected
               • active (bool), aadhaar_url, license_url (Storage: partner-docs bucket)
               • assigned_areas (text[]), assigned_slot_ids (uuid[])

products (standalone)
  └──[1:N]── subscription_plans (product_id → products.id CASCADE)
               • frequency, discount_type/value, default_quantity, popular, active

delivery_slots (standalone)
faq (standalone)
content_blocks (standalone)
coupons (standalone)
app_settings (key/value JSONB store)
site_content (key/value JSONB store)
serviceable_pincodes (standalone)
phone_otps (internal — no RLS policies, service_role only)
```

### 3b. PostgreSQL Triggers & Active Functions

| Trigger | Table | Function | Purpose |
|---|---|---|---|
| `on_auth_user_created` | `auth.users` AFTER INSERT | `handle_new_user()` | Creates profile + inserts `customer` role |
| `auto_grant_admin_trigger` | `profiles` AFTER INSERT OR UPDATE OF email | `auto_grant_admin()` | Grants `admin` to whitelisted emails |
| `trg_profiles_updated` | `profiles` BEFORE UPDATE | `update_updated_at_column()` | Timestamps |
| `trg_addr_updated` | `addresses` BEFORE UPDATE | `update_updated_at_column()` | Timestamps |
| `trg_orders_updated` | `orders` BEFORE UPDATE | `update_updated_at_column()` | Timestamps |
| `trg_products_updated` | `products` BEFORE UPDATE | `update_updated_at_column()` | Timestamps |
| `trg_faq_updated` | `faq` BEFORE UPDATE | `update_updated_at_column()` | Timestamps |
| `trg_content_updated` | `content_blocks` BEFORE UPDATE | `update_updated_at_column()` | Timestamps |
| `trg_coupon_updated` | `coupons` BEFORE UPDATE | `update_updated_at_column()` | Timestamps |
| `app_settings_set_updated_at` | `app_settings` BEFORE UPDATE | `update_updated_at_column()` | Timestamps |
| `site_content_updated_at` | `site_content` BEFORE UPDATE | `update_updated_at_column()` | Timestamps |
| `plans_set_updated_at` | `subscription_plans` BEFORE UPDATE | `update_updated_at_column()` | Timestamps |
| `subs_set_updated_at` | `subscriptions` BEFORE UPDATE | `update_updated_at_column()` | Timestamps |
| `partners_set_updated_at` | `delivery_partners` BEFORE UPDATE | `update_updated_at_column()` | Timestamps |
| `slots_set_updated_at` | `delivery_slots` BEFORE UPDATE | `update_updated_at_column()` | Timestamps |
| `pincodes_set_updated_at` | `serviceable_pincodes` BEFORE UPDATE | `update_updated_at_column()` | Timestamps |

**Active RPCs / Security-Definer Functions:**
- `has_role(uuid, app_role)` — used in every RLS policy
- `handle_new_user()` — profile bootstrap
- `auto_grant_admin()` — email-based admin seeding
- `email_exists(text)` / `phone_exists(text)` — uniqueness checks (GRANT to anon + authenticated)
- `is_active_partner(uuid)` — checks delivery_partners table
- `partner_update_order_status(order_id, new_status)` — SECURITY DEFINER, partner-scoped status transitions
- `compute_next_delivery_date(frequency, from_date)` — IMMUTABLE helper for subscription scheduling

**Edge Functions:** `phone-auth` (Deno) — the entire OTP engine.

> [!NOTE]
> There is **no inventory management trigger** in the current codebase. `stock_quantity` is decremented by zero triggers — placing an order does not reduce stock in the DB. This is a known gap from previous audit conversations.

### 3c. Real-time Subscription Logic — Admin Promotion Flow

```
Admin promotes user (via AdminStaff.tsx → upsert into user_roles)
  │
  ▼ [Supabase Realtime — supabase_realtime publication]
  Tables published: app_settings, user_roles, profiles, delivery_partners
  │
  ▼
AuthContext channel `user_roles_${uid}` receives postgres_changes event
  │
  ▼
refreshSessionAndRole(uid):
  1. supabase.auth.refreshSession()  ← refreshes JWT (role not in JWT, but triggers re-read)
  2. resolveRoleNow(uid)             ← re-queries user_roles → sets isAdmin = true
  3. setSession(current → spread)   ← forces re-render of all session consumers
  │
  ▼
StaffPortalLink re-renders → "Admin Portal" button appears instantly
RequireAuth re-evaluates → protected routes become accessible
```

---

## 4. Commerce & Subscription Engine

### 4a. UnifiedProductCard Logic

**Mode toggle:** Local `useState<"once" | "subscribe">`. The toggle is purely client-side CSS/state — no DB call.

**Price calculation chain:**
```
product.discountPrice          (base price, from DB discounted_price)
  │
  ▼
computeDiscountedPrice(basePrice, freq, plan?)
  • If plan exists and discount_type === "amount": basePrice - plan.discount_value
  • If plan exists and discount_type === "percent": basePrice * (1 - plan.discount_value/100)
  • If NO plan (fallback): DEFAULT_FREQ_DISCOUNT = { daily: 15%, alternate: 12%, weekly: 8% }
  │
  ▼
subPrice = computeDiscountedPrice(...)    ← price per delivery in subscribe mode
perDelivery = product.discountPrice - subPrice   ← savings per delivery
monthly = perDelivery × FREQUENCY_META[freq].perMonth  ← {daily:30, alternate:15, weekly:4}
```

**Savings badge:** `Save ₹{monthly} / month vs one-time` — only shows if monthly > 0.

**Plan lookup:** `useSubscriptionPlans` fetches all active plans (staleTime: 60s). The card finds the matching plan via `plans.find(p => p.product_id === product.id && p.frequency === freq)`. If no matching plan exists, the fallback default discounts are used.

**Subscribe CTA flow (one-time product card, not checkout):**
1. If unauthenticated → redirect to `/auth?next=/`
2. Fetch user's default address. If none → redirect to `/profile?addAddress=1`
3. Fetch first active delivery slot
4. `INSERT INTO subscriptions` with status=`active`, payment_method=`cod`
5. Toast success. No payment collected at this point.

> [!WARNING]
> Subscribe from the product card **bypasses JIT profile completeness check**. A user with no email or name can subscribe directly. Only the checkout page enforces JIT blocking. This is a gap if profile completeness matters for subscriptions.

### 4b. Admin Subscription CRUD → Homepage Propagation

```
Admin edits plan in AdminSubscriptions.tsx
  │  save.mutate(plan) → supabase.from("subscription_plans").update/insert
  │
  ▼
onSuccess:
  qc.invalidateQueries({ queryKey: ["admin_subscription_plans"] })  // admin list
  qc.invalidateQueries({ queryKey: ["subscription_plans"] })        // homepage cards
  qc.invalidateQueries({ queryKey: ["products"] })                  // product list refresh
  │
  ▼
useSubscriptionPlans() (used in UnifiedProductCard) re-fetches
  ▼
All product cards re-render with new discount values/plan availability
```

**Note:** This propagation is React Query cache invalidation only — no realtime channel on `subscription_plans`. If another browser tab is open, it will NOT auto-update. The admin and the card must be in the same tab/session for immediate refresh.

### 4c. Razorpay Ghost Implementation

**Location:** `src/lib/payments/razorpay.ts` + `src/lib/payments/payment.service.ts`  
**Checkout components:** `src/components/checkout/Razorpay.tsx` (empty wrapper) + `RazorpayButton.tsx` (stub, not used in checkout flow).

**How demo checkout is triggered:**

```
Checkout.tsx → placeOrder() → payment === "online"
  │
  ▼
payNow(grand)  [src/lib/payments/razorpay.ts]
  │
  ├── createOrder(amount): await 400ms → returns { id: "order_demo_...", amount_paise, currency:"INR" }
  │
  └── openCheckout(order): await 1500ms → returns {
        ok: true,
        payment_id: "pay_demo_<random>",
        order_id: "order_demo_...",
        signature: "demo_signature"
      }
  │
  ▼
onlinePaid = true
Order inserted into DB with payment_status = "paid"
```

**No real Razorpay SDK is loaded.** The `window.Razorpay` object is never referenced. To go live, replace the body of `createOrder` and `openCheckout` with actual Razorpay SDK calls + server-side order creation endpoint. The facade in `payment.service.ts` means only `razorpay.ts` needs to change.

---

## 5. Logic Audit & Dead Ends

### 5a. Dead Code & Ghost Components

| Item | Location | Status |
|---|---|---|
| `src/components/checkout/Razorpay.tsx` | Checkout components | Ghost — renders nothing (`export default () => null` effectively). Not imported anywhere in the checkout flow. |
| `src/components/checkout/RazorpayButton.tsx` | Checkout components | Stub — defined but never used in `Checkout.tsx`. The real payment is invoked via `payNow()` directly. |
| `src/lib/mockOtp.ts` | lib/ | Exists but not imported anywhere in active code. Superseded by the Edge Function. |
| `partner` role in `user_roles` | `usePartnerStatus.ts` L34 | Queries for `role = 'partner'` in `user_roles`, but `app_role` ENUM only has `customer` and `admin`. This query will always return 0 rows. Partner access is correctly derived from `delivery_partners` table status. |
| `step` state in `Checkout.tsx` | `Checkout.tsx` L26 | A `step` useState (1,2,3) exists and drives the progress bar UI, but `setStep()` is never called. The progress bar is permanently stuck at step 1 rendering all 3 bars. The steps never advance. |
| `lat`/`lng` on `orders` | Migration 9 | Added to schema, fetched from address (`(addr as any)?.lat`) and stored, but no mapping or delivery radius logic uses these values on the frontend yet. |
| "Deliver to Bandra W, 400050" | `Header.tsx` L32 | Hardcoded string — not derived from user's address or `serviceable_pincodes`. |
| `pages/Orders.tsx` | Pages | Only 504 bytes — likely a thin wrapper. (Not fully audited but noted as minimal.) |

### 5b. Race Conditions & Failure Points

#### RC-1: Subscribe Before Profile Loads
**Scenario:** User clicks "Subscribe" on `UnifiedProductCard` immediately after page load before `useProfileCompleteness` resolves.  
**Current behavior:** The `subscribe()` function checks `if (!user)` → redirect to auth. If user exists but profile is loading, it proceeds immediately. The subscription is inserted without checking profile completeness (no name, no email).  
**Risk:** Subscriptions exist for users with incomplete profiles. Delivery communication fails.  
**Fix:** Add `useProfileCompleteness` check in `subscribe()` before DB insert.

#### RC-2: Double OTP Send / Resend Race
**Scenario:** User clicks "Send OTP" twice quickly before `busy` state sets.  
**Current behavior:** Both clicks fire `sendCode()`. The edge function invalidates previous OTPs before inserting, so the second call creates a fresh OTP. The first OTP row is marked used. This is handled correctly in the edge function.  
**Risk:** Low — edge function handles it. UI `busy` flag prevents most double-clicks.

#### RC-3: Cart Persists Stale Prices
**Scenario:** Admin changes product price. User has old product in localStorage cart.  
**Current behavior:** `CartContext` initializes from `localStorage` and never re-validates prices against the DB.  
**Risk:** Order is placed at stale `discountPrice`. The `order_items.price` column records the stale value. No server-side price validation exists.  
**Fix:** Re-hydrate cart prices from DB on `Checkout.tsx` mount.

#### RC-4: Order Insert Without Inventory Guard
**Scenario:** Two users add the last unit of a product to cart simultaneously and both checkout.  
**Current behavior:** No `stock_quantity` decrement trigger exists. Both orders succeed. `stock_quantity` in `products` table is never decremented by any migration or trigger.  
**Risk:** Overselling. Critical for production.  
**Fix:** Add a DB trigger on `order_items INSERT` to decrement `products.stock_quantity` and raise an exception if stock < quantity.

#### RC-5: Session Refresh Race in Auth.tsx
**Scenario:** `handleVerify` calls `setSession` then immediately `refreshSession()` + `wait(500ms)`. If `onAuthStateChange` fires between `setSession` and the redirect, the user may be redirected before `resolveRoleNow` completes.  
**Current behavior:** `AuthContext` sets `loading=false` before role resolves. `RequireAuth` blocks on `roleLoading` for admin routes but not for standard routes.  
**Risk:** User reaches `/` before `isAdmin` is set → "Admin Portal" button flickers in ~200ms later.  
**Fix:** The 500ms wait partially mitigates this. True fix: defer redirect until `roleLoading === false`.

#### RC-6: JitVerifySheet Re-opens After Completion
**Scenario:** `onComplete` in `Checkout.tsx` calls `refetchProfile()`. If the refetch is slow (network), `isComplete` may briefly remain false, causing `verifyOpen` to stay true and the sheet to re-open.  
**Current behavior:** `onComplete={async () => { await refetchProfile(); }}` — the sheet closes when `onComplete` resolves, but `verifyOpen` state is not reset to `false` in `onComplete`. The sheet closes only because `isComplete` becomes true and `open={verifyOpen && !!missing}` evaluates false.  
**Risk:** Brief flash or re-open of the sheet on slow connections.  
**Fix:** Add `setVerifyOpen(false)` inside `onComplete`.

---

## Summary Table — System Health

| Domain | Status | Notes |
|---|---|---|
| Auth / OTP | ✅ Functional | Demo mode. OTP shown on screen. Ready to wire SMS provider. |
| JIT Identity Binding | ✅ Functional | Only enforced at checkout. Missing from subscribe flow. |
| Role Resolution | ✅ Functional | Realtime promotion works. Partner role enum gap is a dead path but harmless. |
| Cart | ⚠️ Partial | No server-side price validation. localStorage only. |
| Checkout | ✅ Functional | Step progress bar UI is broken (stuck at step 1). |
| Razorpay | 🔶 Ghost/Demo | Full simulation. Real keys not wired. Swap two functions to go live. |
| Inventory | ❌ Missing | No stock decrement trigger. Overselling risk. |
| Subscriptions (create) | ✅ Functional | Profile completeness not checked in card subscribe flow. |
| Subscriptions (admin CRUD) | ✅ Functional | Propagates via React Query invalidation only. |
| Realtime | ✅ Functional | `user_roles`, `profiles`, `delivery_partners`, `app_settings` all published. |
| Delivery Partners | ✅ Functional | KYC doc upload, status transitions, partner portal wired. |

---

*Ready for Dry Run audit of the full checkout flow on request.*
