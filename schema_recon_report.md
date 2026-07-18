### SYSTEM SCHEMA RECONNAISSANCE REPORT

#### 1. Database Schema Reconnaissance

**`public.subscriptions` Schema:**
- `id` (uuid) - NOT NULL, Default: `gen_random_uuid()`
- `user_id` (uuid) - NOT NULL
- `product_slug` (text) - NOT NULL
- `quantity` (integer) - Default: `1`
- `frequency` (text) - NOT NULL
- `status` (text) - Default: `'active'`
- `created_at` (timestamp with time zone) - Default: `now()`
- `updated_at` (timestamp with time zone) - Default: `now()`
- `price_per_unit` (numeric) - NOT NULL, Default: `0.00`
- `selected_days` (ARRAY) - Default: `'{}'::text[]`
- `paused_dates` (ARRAY) - Default: `'{}'::date[]`
- `address_id` (uuid)
- `display_id` (text)
- `payment_method` (text)

**`public.manifest_drops` Schema:**
- `id` (uuid) - NOT NULL, Default: `gen_random_uuid()`
- `manifest_id` (uuid)
- `subscription_id` (uuid)
- `user_id` (uuid) - NOT NULL
- `product_slug` (text) - NOT NULL
- `quantity` (integer) - NOT NULL
- `escrow_amount` (numeric) - NOT NULL
- `status` (text) - Default: `'pending'`
- `created_at` (timestamp with time zone) - Default: `now()`
- `address_id` (uuid)

---

#### 2. Cron Job / Generation Logic

**Location / Function Name:**
The daily manifests and drops are generated entirely within the database via the Postgres RPC function: **`generate_tomorrow_roster()`**.

**Summary of Read Logic:**
The RPC function operates by looping over the `public.subscriptions` table directly. 
1. It selects all records where `status = 'active'`.
2. It excludes any subscriptions where tomorrow's date exists inside the `paused_dates` array (`AND NOT (tomorrow_date = ANY(COALESCE(paused_dates, ARRAY[]::date[])))`).
3. For every matched subscription, it calculates the `required_amount` (`sub.quantity * sub.price_per_unit`), attempts to deduct the balance directly from the user's wallet, and if successful, maps the master `sub.quantity` directly into a new `manifest_drops` record.

*(Execution halted as instructed. Awaiting review.)*
