export async function handleSubscriptionPause(supabase: any, subId: string) {
  // Action A: Set status to 'paused'
  const { error: updateErr } = await supabase
    .from("subscriptions")
    .update({ status: "paused" })
    .eq("id", subId);
  if (updateErr) throw updateErr;

  // Action B: Purge/Hold Future Ledger Entries (greater than today)
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  const { error: ledgerErr } = await supabase
    .from("delivery_ledger")
    .delete()
    .eq("subscription_id", subId)
    .in("status", ["pending", "scheduled"])
    .gt("delivery_date", todayStr);
  
  if (ledgerErr) throw ledgerErr;
}

export async function handleSubscriptionResume(supabase: any, subId: string) {
  // Action A: Set status to 'active'
  const { error: updateErr } = await supabase
    .from("subscriptions")
    .update({ status: "active" })
    .eq("id", subId);
  if (updateErr) throw updateErr;

  // Action B: Immediate 2-Week Backfill Loop
  // 1. Fetch subscription details
  const { data: subData, error: fetchErr } = await supabase
    .from("subscriptions")
    .select("*, products(discounted_price, original_price)")
    .eq("id", subId)
    .single();
  
  if (fetchErr || !subData) throw fetchErr || new Error("Subscription not found");

  let allowedDays = subData.selected_days || [];
  if (typeof allowedDays === 'string') {
    try { allowedDays = JSON.parse(allowedDays); } catch(e) {}
  }

  const price = subData.products?.discounted_price !== null && subData.products?.discounted_price !== undefined
    ? subData.products.discounted_price 
    : (subData.products?.original_price || 0);

  const today = new Date();
  
  // Backfill next 14 days starting from TOMORROW
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const dayOfWeek = d.getDay();
    
    if (allowedDays.includes(dayOfWeek) || allowedDays.includes(String(dayOfWeek))) {
      // Upsert safely
      const { data: existing } = await supabase
        .from("delivery_ledger")
        .select("id")
        .eq("user_id", subData.user_id)
        .eq("product_slug", subData.product_slug)
        .eq("delivery_date", dateStr);
        
      if (!existing || existing.length === 0) {
        await supabase
          .from("delivery_ledger")
          .insert({
            user_id: subData.user_id,
            subscription_id: subId,
            delivery_date: dateStr,
            product_slug: subData.product_slug,
            quantity: subData.quantity,
            effective_price: price,
            status: "pending"
          });
      }
    }
  }
}
