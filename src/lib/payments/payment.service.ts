/**
 * Unified payment service. Provider-agnostic facade.
 * Currently routes to the Razorpay scaffold (demo mode).
 */
import { payNow, createOrder, openCheckout, type RzpResult, type RzpOrder } from "./razorpay";

export type PaymentResult = RzpResult;
export type PaymentOrder = RzpOrder;

export const paymentService = {
  createOrder,
  openCheckout,
  payNow,
};

export type { RzpResult, RzpOrder };
