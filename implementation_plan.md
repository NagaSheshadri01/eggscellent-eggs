# Replace Backend Financial Lock with Upfront Checkout Recharge

The current architecture relies on a backend trigger to silently convert scheduled deliveries into an "Unpaid" (`pending_payment`) state if the user's wallet is low. The goal is to completely rip out this backend system, clean up the calendar UI, and replace it with an upfront checkout barrier that redirects users to recharge their wallet before they can even start the subscription.

## User Review Required
> [!WARNING]
> By dropping the `trigger_evaluate_wallet_fulfillment` database trigger, existing subscriptions will no longer automatically block daily deliveries at the database level if the user's balance drops to zero *after* checkout. 
> If you want to stop daily fulfillment when the wallet hits zero, we will need to implement a daily cron job or a lighter trigger later. 
> 
> **Are you okay with dropping the strict daily database lock for now, or do you still want to freeze deliveries if they run out of money mid-subscription?**

## Proposed Changes

---

### Database Layer
Drop the trigger that forces calendar rows into `pending_payment`.

#### [NEW] supabase/migrations/20260525160000_remove_financial_lock.sql
- Create a migration to `DROP TRIGGER IF EXISTS trigger_evaluate_wallet_fulfillment ON public.delivery_ledger`.
- Drop the underlying function `handle_wallet_fulfillment()`.

---

### Frontend UI (Calendar)
Remove all traces of the "Unpaid" calendar state.

#### [MODIFY] src/components/account/SubscriptionCalendar.tsx
- Remove the `pending_payment` color styling (Orange dots).
- Remove the `Unpaid` item from the Legend.
- Remove the `Unpaid` warning badge inside the Fulfillment Modal.

---

### Checkout Flow
Intercept subscription checkouts and verify wallet balance.

#### [MODIFY] src/components/site/CartDrawer.tsx
#### [MODIFY] src/pages/Checkout.tsx
- In `placeOrder`, detect if there are subscription items.
- Fetch the user's `balance` from `public.wallets`.
- Calculate `requiredAmount` (the cost of the subscription items for 1 delivery day).
- If `balance < requiredAmount`, abort the checkout and `nav("/account/wallet?redirect=/checkout&recharge=" + difference)`.

---

### Wallet Recharge Flow
Catch the redirected user and return them after payment.

#### [MODIFY] src/components/account/PrepaidWallet.tsx
- Use `useSearchParams` to detect `recharge` and `redirect`.
- Automatically set the "Custom Amount" input to the required `recharge` value.
- In the Razorpay success callback, check for `redirect`. If it exists, navigate the user back to `/checkout` (which will retain their cart state from `localStorage`).

## Verification Plan

### Manual Verification
1. Create a cart with a subscription.
2. Empty the test user's wallet balance to 0.
3. Click "Place Order" in checkout. Verify it intercepts the order and redirects to `/account/wallet` with the correct query parameters.
4. Complete the demo Razorpay recharge.
5. Verify the wallet automatically redirects back to `/checkout`.
6. Verify placing the order now succeeds.
7. Check the calendar to ensure no orange dots appear by default.
