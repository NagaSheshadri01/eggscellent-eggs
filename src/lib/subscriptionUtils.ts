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

  const { data: items } = await supabase.from('subscription_items').select('id').eq('subscription_id', subId);
  const itemIds = items?.map((i: any) => i.id) || [];
  if (itemIds.length > 0) {
    const { error: ledgerErr } = await supabase
      .from("subscription_calendar_ledger")
      .delete()
      .in("subscription_item_id", itemIds)
      .in("status", ["pending", "scheduled"])
      .gt("delivery_date", todayStr);
    
    if (ledgerErr) throw ledgerErr;
  }
}

export async function handleSubscriptionResume(supabase: any, subId: string) {
  // Action A: Set status to 'active'
  const { error: updateErr } = await supabase
    .from("subscriptions")
    .update({ status: "active" })
    .eq("id", subId);
  if (updateErr) throw updateErr;

  // Action B: Immediate 2-Week Backfill Loop
  const { data: subData, error: fetchErr } = await supabase
    .from("subscriptions")
    .select("*, subscription_plans(price_per_delivery), subscription_items(*)")
    .eq("id", subId)
    .single();
  
  if (fetchErr || !subData) throw fetchErr || new Error("Subscription not found");

  const today = new Date();
  
  for (const item of subData.subscription_items || []) {
    let allowedDays = item.selected_days || [];
    if (typeof allowedDays === 'string') {
      try { allowedDays = JSON.parse(allowedDays); } catch(e) {}
    }
    
    const price = subData.subscription_plans?.price_per_delivery || 0;

    for (let i = 1; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const dayOfWeek = d.getDay();
      
      if (allowedDays.includes(dayOfWeek) || allowedDays.includes(String(dayOfWeek))) {
        const { data: existing } = await supabase
          .from("subscription_calendar_ledger")
          .select("id")
          .eq("subscription_item_id", item.id)
          .eq("delivery_date", dateStr);
          
        if (!existing || existing.length === 0) {
          const { error: insertErr } = await supabase
            .from("subscription_calendar_ledger")
            .insert({
              subscription_item_id: item.id,
              delivery_date: dateStr,
              product_slug: item.product_slug,
              quantity: item.quantity,
              effective_price: price,
              status: "scheduled"
            });
          if (insertErr) {
            console.error("Ledger insertion failed:", insertErr);
            throw insertErr;
          }
        }
      }
    }
  }
}
