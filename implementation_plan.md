# Subscription Overrides & Skip Logic Architecture

This plan details the implementation of a new subscription override architecture as requested.

## Proposed Changes

### Database Layer
- **New Table:** `public.subscription_overrides`
  - Columns: `id` (uuid), `subscription_id` (uuid, FK cascade), `target_date` (date), `new_quantity` (int), `created_at` (timestamp).
  - Constraint: `UNIQUE(subscription_id, target_date)` to restrict to one override per day.
- **RPC Update:** `public.generate_tomorrow_roster()`
  - Re-written to loop through active subscriptions, checking against `paused_dates`.
  - Added logic to query `subscription_overrides` for tomorrow's date.
  - Wallet deduction calculated using `(effective_quantity * price_per_unit)`.

### Frontend Layer
- **Component:** `src/components/account/SubscriptionCalendar.tsx`
  - Modify `handleUpdateQuantity` to handle un-manifested future days (projected items).
  - **Skip Logic:** If quantity is set to 0, or user clicks delete on a projected item, push `target_date` into the master subscription's `paused_dates` array.
  - **Override Logic:** If quantity > 0 and differs from master, perform an upsert into `subscription_overrides`.

## Verification Plan

### Automated Tests
- `npx tsc --noEmit` to verify type safety in the frontend component.

### Manual Verification
- Will apply `NOTIFY pgrst, 'reload schema'` to ensure the PostgREST API immediately recognizes the new `subscription_overrides` table.
- Human review and functional testing of the calendar UI to confirm that overrides and skips behave correctly for projected un-manifested deliveries.
