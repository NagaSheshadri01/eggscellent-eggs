/**
 * Razorpay scaffold — provider-agnostic shape.
 * For now, both methods simulate a 1.5s success so the UX is fully testable.
 * Swap the body of these two functions with real Razorpay calls when keys are added.
 */

export type RzpOrder = {
  id: string;          // Razorpay order id
  amount: number;      // in paise
  currency: "INR";
};

export type RzpResult =
  | { ok: true; payment_id: string; order_id: string; signature: string }
  | { ok: false; error: string };

export const createOrder = async (amountRupees: number): Promise<RzpOrder> => {
  await new Promise((r) => setTimeout(r, 400));
  return {
    id: `order_demo_${Date.now()}`,
    amount: Math.round(amountRupees * 100),
    currency: "INR",
  };
};

export const openCheckout = async (order: RzpOrder): Promise<RzpResult> => {
  await new Promise((r) => setTimeout(r, 1500));
  return {
    ok: true,
    payment_id: `pay_demo_${Math.random().toString(36).slice(2, 10)}`,
    order_id: order.id,
    signature: "demo_signature",
  };
};

export const payNow = async (amountRupees: number): Promise<RzpResult> => {
  const order = await createOrder(amountRupees);
  return openCheckout(order);
};