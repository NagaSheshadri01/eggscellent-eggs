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
