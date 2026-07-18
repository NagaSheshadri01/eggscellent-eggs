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
  const { error } = await supabase.from('subscription_calendar_overrides').insert({
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
