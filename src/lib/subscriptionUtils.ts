import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";

export async function handleSubscriptionPause(supabase: SupabaseClient<Database>, subId: string) {
  // Set status to 'paused'
  const { error: updateErr } = await supabase
    .from("subscriptions")
    .update({ status: "paused" })
    .eq("id", subId);
  if (updateErr) throw updateErr;

  // Ledger purging is no longer necessary as projection is dynamic based on status
}

export async function handleSubscriptionResume(supabase: SupabaseClient<Database>, subId: string) {
  // Set status to 'active'
  const { error: updateErr } = await supabase
    .from("subscriptions")
    .update({ status: "active" })
    .eq("id", subId);
  if (updateErr) throw updateErr;
  
  // Ledger backfilling is no longer necessary as projection is dynamic based on status
}

export async function executeGodModeOverride(
  supabase: SupabaseClient<Database>,
  params: {
    userId: string;
    subscriptionId?: string;
    overrideDate: string;
    productId: string;
    operation: 'ADD' | 'REMOVE' | 'UPDATE_QUANTITY';
    quantity: number;
    notes?: string;
  }
) {
  const { error } = await (supabase as any).from('subscription_calendar_overrides').insert({
    user_id: params.userId,
    subscription_id: params.subscriptionId || null,
    override_date: params.overrideDate,
    product_id: params.productId,
    operation: params.operation,
    quantity: params.quantity,
    notes: params.notes || null,
  });

  if (error) {
    throw error;
  }
}

export async function executeUserAddon(
  supabase: SupabaseClient<any>,
  params: {
    userId: string;
    overrideDate: string;
    productId: string;
    quantity: number;
  }
) {
  if (!params.userId || !params.overrideDate || !params.productId || params.quantity <= 0) {
    throw new Error('Invalid parameters provided for user addon.');
  }

  // Time Lock check
  const now = new Date();
  const targetDate = new Date(params.overrideDate);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  // If target date is tomorrow, check time lock (9:00 PM)
  if (targetDate.getTime() === tomorrow.getTime()) {
    if (now.getHours() >= 21) {
      throw new Error('Time Lock: You cannot add items for tomorrow after 9:00 PM.');
    }
  }

  // Wallet and Product Price check
  const { data: product, error: productErr } = await (supabase as any)
    .from('products')
    .select('original_price')
    .eq('id', params.productId)
    .single();

  if (productErr || !product) {
    throw new Error('Product not found or database error.');
  }

  const { data: wallet, error: walletErr } = await (supabase as any)
    .from('wallets')
    .select('balance')
    .eq('user_id', params.userId)
    .single();

  if (walletErr || !wallet) {
    throw new Error('Wallet not found or database error.');
  }

  const totalCost = product.original_price * params.quantity;
  if (wallet.balance < totalCost) {
    throw new Error('Insufficient Funds');
  }

  // Authorization only - actual deduction deferred to delivery phase

  const { error: insertErr } = await (supabase as any).from('subscription_calendar_overrides').insert({
    user_id: params.userId,
    subscription_id: null,
    override_date: params.overrideDate,
    product_id: params.productId,
    operation: 'ADD',
    quantity: params.quantity,
    notes: 'User Add-on',
  });

  if (insertErr) {
    throw new Error(`Failed to insert addon: ${insertErr.message}`);
  }
}
