const fs = require('fs');
const path = 'scratch/AccountSubscriptions.tsx';
let code = fs.readFileSync(path, 'utf8');

const changeDaysOld = `      // 1. Update selected_days AND next_delivery_date atomically
      const { error } = await (supabase as any)
        .from("subscriptions")
        .update({ selected_days: newDays, next_delivery_date: nextDeliveryDate })
        .eq("id", subId);`;

const changeDaysNew = `      // 1. Update selected_days on ALL items in this subscription (assuming unified schedule)
      const { error } = await (supabase as any)
        .from("subscription_items")
        .update({ selected_days: newDays })
        .eq("subscription_id", subId);`;

code = code.replace(changeDaysOld, changeDaysNew);

const uiLoopOld = `{contracts.map((sub: any) => {
        const plan = sub.subscription_plans || {
          title: sub.products?.name || 'Egg Subscription',
          description: "Structured subscription deliveries",
          frequency_type: sub.selected_days?.length === 7 ? "daily" : sub.selected_days?.length === 3 ? "alternate" : "weekly",
          price_per_delivery: sub.products?.discounted_price || sub.effective_price || 0
        };
        const addr = sub.addresses;
        const isWeekly = plan.frequency_type === "weekly";
        const isAlternate = plan.frequency_type === "alternate";

        // Resolve Option A / Option B days for alternate
        let optADays = [0, 2, 4];
        let optBDays = [1, 3, 5];
        if (isAlternate && plan) {
          const cDays = plan.custom_days || [];
          const dividerIndex = cDays.indexOf(-1);
          if (dividerIndex !== -1) {
            optADays = cDays.slice(0, dividerIndex);
            optBDays = cDays.slice(dividerIndex + 1);
          } else if (cDays.length > 0) {
            optADays = cDays;
          }
        }

        const getDaysLabel = (days: number[]) => {
          const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          return days.map(d => DAYS_SHORT[d]).join("/");
        };

        const isOptionA = optADays.every(d => sub.selected_days.includes(d)) && sub.selected_days.length === optADays.length;
        const isOptionB = optBDays.every(d => sub.selected_days.includes(d)) && sub.selected_days.length === optBDays.length;

        return (
          <div 
            key={sub.id} 
            className={\`relative bg-card rounded-3xl border shadow-soft overflow-hidden transition-all duration-300 \${
              sub.status === "cancelled" 
                ? "border-border/30 opacity-60 grayscale" 
                : sub.status === "paused"
                ? "border-amber-200/60 bg-amber-50/10"
                : "border-border/60 hover:border-primary/30"
            }\`}
          >
            {/* Top-right Settings Icon */}
            {sub.status !== "cancelled" && (
              <div className="absolute top-4 right-4 z-10">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-secondary/60">
                      <Settings className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-soft border-border/60">
                    <DropdownMenuItem 
                      onClick={() => handlePauseIntercept(sub.id, sub.status)}
                      className="cursor-pointer py-2.5 rounded-lg font-medium text-xs flex items-center"
                    >
                      {sub.status === "active" ? <PauseCircle className="w-4 h-4 mr-2" /> : <PlayCircle className="w-4 h-4 mr-2" />} 
                      {sub.status === "active" ? "Pause Subscription" : "Resume Subscription"}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => { setCancelModal({ open: true, subId: sub.id }); setCancelText(""); }}
                      className="cursor-pointer py-2.5 rounded-lg font-medium text-xs flex items-center text-red-600 focus:text-red-700 focus:bg-red-50"
                    >
                      <XCircle className="w-4 h-4 mr-2" /> Cancel Subscription
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            {/* Top info row */}
            <div className="p-5 sm:p-6 border-b border-border/40 flex gap-4 items-start">
              <img 
                src={sub.products?.image_url || "/placeholder.png"} 
                alt={plan.title}
                className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-border/40 bg-secondary/30"
              />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display font-bold text-brown text-lg leading-tight">
                        {plan.title}
                      </h3>
                      <Badge 
                        variant="outline"
                        className={\`text-[9px] uppercase tracking-tighter \${
                          sub.status === "active" 
                            ? "bg-green-50 text-green-700 border-green-200" 
                            : sub.status === "paused"
                            ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }\`}
                      >
                        {sub.status === "active" ? "Active" : sub.status === "paused" ? "Paused" : sub.status === "cancelled" ? "Cancelled" : sub.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 max-w-md">
                      {plan.description || "Recurring freshness on schedule"}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="block text-[9px] text-muted-foreground uppercase font-bold">Price Rate</span>
                    <span className="font-display font-extrabold text-brown text-xl">
                      ₹{plan.price_per_delivery || "N/A"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">/delivery</span>
                  </div>
                </div>

                {/* Grid detail overview */}
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/30 text-xs">
                  <div className="space-y-1">
                    <span className="block text-[9px] text-muted-foreground uppercase font-bold">Fulfillment Details</span>
                    <div className="flex items-center gap-1.5 text-brown font-medium">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      <span className="capitalize">
                        {plan.frequency_type.replace(/_/g, " ")} ({sub.quantity} pack)
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="block text-[9px] text-muted-foreground uppercase font-bold">Delivery Destination</span>
                    {addr ? (
                      <div className="flex items-start gap-1.5 text-slate-600 max-w-xs leading-snug">
                        <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                        <span>
                          {addr.address_line_1}
                          {addr.address_line_2 ? \`, \${addr.address_line_2}\` : ""}
                          {addr.landmark ? \`, Near \${addr.landmark}\` : ""}
                          <br />
                          {addr.city} - {addr.pincode}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">No address bound</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions row */}
            {sub.status !== "cancelled" && (
              <div className="px-5 py-4 bg-secondary/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* A. Customer Day Recalibrator (only) */}
                {(isWeekly || isAlternate) && (
                  <div className="flex flex-col items-center sm:items-end gap-1.5 shrink-0">
                    <span className="text-[9px] text-muted-foreground uppercase font-bold">Your Delivery Days</span>
                    
                    {isAlternate && (
                      <div className="flex gap-1.5 bg-background p-1 rounded-xl border border-border/80">
                        <button
                          type="button"
                          disabled={changeDaysMutation.isPending}
                          onClick={() => changeDaysMutation.mutate({ subId: sub.id, newDays: optADays })}
                          className={\`px-2 py-1 rounded-lg text-[9px] font-bold transition-all \${
                            isOptionA
                              ? "bg-primary text-primary-foreground shadow"
                              : "bg-card hover:bg-secondary/40 text-muted-foreground"
                          }\`}
                        >
                          {getDaysLabel(optADays)}
                        </button>
                        <button
                          type="button"
                          disabled={changeDaysMutation.isPending}
                          onClick={() => changeDaysMutation.mutate({ subId: sub.id, newDays: optBDays })}
                          className={\`px-2 py-1 rounded-lg text-[9px] font-bold transition-all \${
                            isOptionB
                              ? "bg-primary text-primary-foreground shadow"
                              : "bg-card hover:bg-secondary/40 text-muted-foreground"
                          }\`}
                        >
                          {getDaysLabel(optBDays)}
                        </button>
                      </div>
                    )}

                    {isWeekly && (
                      <div className="flex gap-1 bg-background p-1 rounded-xl border border-border/80">
                        {DAYS.map((day, idx) => {
                          const isSelected = sub.selected_days.includes(idx);
                          return (
                            <button
                              key={day}
                              type="button"
                              disabled={changeDaysMutation.isPending}
                              onClick={() => changeDaysMutation.mutate({ subId: sub.id, newDays: [idx] })}
                              className={\`w-7 h-7 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center \${
                                isSelected
                                  ? "bg-primary text-primary-foreground shadow"
                                  : "bg-card hover:bg-secondary/40 text-muted-foreground"
                              }\`}
                            >
                              {day[0]}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>
        );
      })}`;

const uiLoopNew = `{contracts.map((sub: any) => {
        const addr = sub.addresses;
        const items = sub.subscription_items || [];
        // Extract common selected_days / frequency from the first item (assuming bundled schedule)
        const firstItem = items[0] || {};
        const isWeekly = firstItem.frequency === "weekly";
        const isAlternate = firstItem.frequency === "alternate";
        const commonDays = firstItem.selected_days || [];

        let optADays = [0, 2, 4];
        let optBDays = [1, 3, 5];

        const getDaysLabel = (days: number[]) => {
          const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          return days.map(d => DAYS_SHORT[d]).join("/");
        };

        const isOptionA = optADays.every(d => commonDays.includes(d)) && commonDays.length === optADays.length;
        const isOptionB = optBDays.every(d => commonDays.includes(d)) && commonDays.length === optBDays.length;

        return (
          <div 
            key={sub.id} 
            className={\`relative bg-card rounded-3xl border shadow-soft overflow-hidden transition-all duration-300 \${
              sub.status === "cancelled" 
                ? "border-border/30 opacity-60 grayscale" 
                : sub.status === "paused"
                ? "border-amber-200/60 bg-amber-50/10"
                : "border-border/60 hover:border-primary/30"
            }\`}
          >
            {/* Top-right Settings Icon */}
            {sub.status !== "cancelled" && (
              <div className="absolute top-4 right-4 z-10">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-secondary/60">
                      <Settings className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-soft border-border/60">
                    <DropdownMenuItem 
                      onClick={() => handlePauseIntercept(sub.id, sub.status)}
                      className="cursor-pointer py-2.5 rounded-lg font-medium text-xs flex items-center"
                    >
                      {sub.status === "active" ? <PauseCircle className="w-4 h-4 mr-2" /> : <PlayCircle className="w-4 h-4 mr-2" />} 
                      {sub.status === "active" ? "Pause Subscription" : "Resume Subscription"}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => { setCancelModal({ open: true, subId: sub.id }); setCancelText(""); }}
                      className="cursor-pointer py-2.5 rounded-lg font-medium text-xs flex items-center text-red-600 focus:text-red-700 focus:bg-red-50"
                    >
                      <XCircle className="w-4 h-4 mr-2" /> Cancel Subscription
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            
            {/* Items Loop */}
            {items.map((item: any) => (
              <div key={item.id} className="p-5 sm:p-6 border-b border-border/40 flex gap-4 items-start">
                <img 
                  src={item.products?.image_url || "/placeholder.png"} 
                  alt={item.products?.name}
                  className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-border/40 bg-secondary/30"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display font-bold text-brown text-lg leading-tight">
                          {item.products?.name || "Subscription Item"}
                        </h3>
                        <Badge 
                          variant="outline"
                          className={\`text-[9px] uppercase tracking-tighter \${
                            sub.status === "active" 
                              ? "bg-green-50 text-green-700 border-green-200" 
                              : sub.status === "paused"
                              ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }\`}
                        >
                          {sub.status === "active" ? "Active" : sub.status === "paused" ? "Paused" : sub.status === "cancelled" ? "Cancelled" : sub.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 max-w-md">
                        {item.quantity}x • {item.frequency}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="block text-[9px] text-muted-foreground uppercase font-bold">Price Rate</span>
                      <span className="font-display font-extrabold text-brown text-xl">
                        ₹{item.products?.discounted_price || item.products?.original_price || "N/A"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">/delivery</span>
                    </div>
                  </div>

                  {/* Grid detail overview */}
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/30 text-xs">
                    <div className="space-y-1">
                      <span className="block text-[9px] text-muted-foreground uppercase font-bold">Fulfillment Details</span>
                      <div className="flex items-center gap-1.5 text-brown font-medium">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        <span className="capitalize">
                          {item.frequency.replace(/_/g, " ")} ({item.quantity} pack)
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="block text-[9px] text-muted-foreground uppercase font-bold">Delivery Destination</span>
                      {addr ? (
                        <div className="flex items-start gap-1.5 text-slate-600 max-w-xs leading-snug">
                          <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                          <span>
                            {addr.address_line_1}
                            {addr.address_line_2 ? \`, \${addr.address_line_2}\` : ""}
                            {addr.landmark ? \`, Near \${addr.landmark}\` : ""}
                            <br />
                            {addr.city} - {addr.pincode}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">No address bound</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Actions row */}
            {sub.status !== "cancelled" && (
              <div className="px-5 py-4 bg-secondary/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* A. Customer Day Recalibrator (only) */}
                {(isWeekly || isAlternate) && (
                  <div className="flex flex-col items-center sm:items-end gap-1.5 shrink-0">
                    <span className="text-[9px] text-muted-foreground uppercase font-bold">Your Delivery Days</span>
                    
                    {isAlternate && (
                      <div className="flex gap-1.5 bg-background p-1 rounded-xl border border-border/80">
                        <button
                          type="button"
                          disabled={changeDaysMutation.isPending}
                          onClick={() => changeDaysMutation.mutate({ subId: sub.id, newDays: optADays })}
                          className={\`px-2 py-1 rounded-lg text-[9px] font-bold transition-all \${
                            isOptionA
                              ? "bg-primary text-primary-foreground shadow"
                              : "bg-card hover:bg-secondary/40 text-muted-foreground"
                          }\`}
                        >
                          {getDaysLabel(optADays)}
                        </button>
                        <button
                          type="button"
                          disabled={changeDaysMutation.isPending}
                          onClick={() => changeDaysMutation.mutate({ subId: sub.id, newDays: optBDays })}
                          className={\`px-2 py-1 rounded-lg text-[9px] font-bold transition-all \${
                            isOptionB
                              ? "bg-primary text-primary-foreground shadow"
                              : "bg-card hover:bg-secondary/40 text-muted-foreground"
                          }\`}
                        >
                          {getDaysLabel(optBDays)}
                        </button>
                      </div>
                    )}

                    {isWeekly && (
                      <div className="flex gap-1 bg-background p-1 rounded-xl border border-border/80">
                        {DAYS.map((day, idx) => {
                          const isSelected = commonDays.includes(idx);
                          return (
                            <button
                              key={day}
                              type="button"
                              disabled={changeDaysMutation.isPending}
                              onClick={() => changeDaysMutation.mutate({ subId: sub.id, newDays: [idx] })}
                              className={\`w-7 h-7 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center \${
                                isSelected
                                  ? "bg-primary text-primary-foreground shadow"
                                  : "bg-card hover:bg-secondary/40 text-muted-foreground"
                              }\`}
                            >
                              {day[0]}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}`;

code = code.replace(uiLoopOld, uiLoopNew);

// Remove the obsolete .in("status", ["scheduled", "skipped"]) ledger cancellation logic.
const cancelFutureOld = `      // 2. Cancel all future scheduled/skipped ledger rows so they don't ghost on the calendar.
      //    New rows will be JIT-seeded for the new days on next calendar load.
      await (supabase as any)
        .from("delivery_ledger")
        .update({ status: "cancelled" })
        .eq("subscription_id", subId)
        .in("status", ["scheduled", "skipped"])
        .gte("delivery_date", todayStr);`;

const cancelFutureNew = `      // 2. Clear out future calendar ledger overrides to reset the schedule
      await (supabase as any)
        .from("subscription_calendar_ledger")
        .delete()
        .eq("subscription_id", subId)
        .gte("delivery_date", todayStr);`;

code = code.replace(cancelFutureOld, cancelFutureNew);

fs.writeFileSync(path, code);
console.log('AccountSubscriptions.tsx fully rewritten.');
