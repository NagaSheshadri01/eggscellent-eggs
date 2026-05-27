import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Calendar, MapPin, RefreshCw, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

type SubscriptionContract = {
  id: string;
  user_id: string;
  product_slug: string;
  product_id: string;
  plan_id: string | null;
  quantity: number;
  selected_days: number[];
  address_id: string | null;
  status: string;
  next_delivery_date: string;
  slot_id: string | null;
  created_at: string;
  addresses?: {
    address_line_1: string;
    address_line_2: string | null;
    landmark: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
  } | null;
  subscription_plans?: {
    id: string;
    title: string;
    description: string | null;
    frequency_type: string;
    price_per_delivery: number;
  } | null;
  products?: {
    name: string;
  } | null;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const AccountSubscriptions = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pauseModal, setPauseModal] = useState<{ open: boolean; subId: string; status: string }>({ open: false, subId: "", status: "" });

  const { data: contracts = [], isLoading, error, refetch } = useQuery<SubscriptionContract[]>({
    queryKey: ["user-subscriptions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          *,
          products:product_id (name, discounted_price, image_url),
          subscription_plans:plan_id (*),
          addresses:address_id (address_line_1, address_line_2, landmark, city, state, pincode)
        `)
        .eq("user_id", user.id)
        .in("status", ["active", "paused"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user
  });

  const togglePauseMutation = useMutation({
    mutationFn: async ({ subId, currentStatus }: { subId: string; currentStatus: string }) => {
      const nextStatus = currentStatus === "active" ? "paused" : "active";
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: nextStatus })
        .eq("id", subId);

      if (error) throw error;
      return { subId, nextStatus };
    },
    onSuccess: (res) => {
      toast.success(`Subscription successfully ${res.nextStatus === "active" ? "resumed" : "paused"}!`);
      queryClient.invalidateQueries({ queryKey: ["user-subscriptions", user?.id] });
    },
    onError: (err: any) => {
      toast.error(`Operation failed: ${err.message}`);
    }
  });

  const changeDaysMutation = useMutation({
    mutationFn: async ({ subId, newDays }: { subId: string; newDays: number[] }) => {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

      // Compute the next upcoming date that falls on one of newDays
      const nextDeliveryDate = (() => {
        for (let offset = 1; offset <= 14; offset++) {
          const d = new Date(today);
          d.setDate(today.getDate() + offset);
          if (newDays.includes(d.getDay())) {
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
          }
        }
        return todayStr; // fallback (shouldn't happen with valid days)
      })();

      // 1. Update selected_days AND next_delivery_date atomically
      const { error } = await supabase
        .from("subscriptions")
        .update({ selected_days: newDays, next_delivery_date: nextDeliveryDate })
        .eq("id", subId);

      if (error) throw error;

      // 2. Cancel all future scheduled/skipped ledger rows so they don't ghost on the calendar.
      //    New rows will be JIT-seeded for the new days on next calendar load.
      await supabase
        .from("delivery_ledger")
        .update({ status: "cancelled" })
        .eq("subscription_id", subId)
        .in("status", ["scheduled", "skipped"])
        .gte("delivery_date", todayStr);
    },
    onMutate: async ({ subId, newDays }) => {
      // Optimistically patch the in-memory contracts cache so the UI
      // reflects the new selected_days and next_delivery_date immediately
      await queryClient.cancelQueries({ queryKey: ['user-subscriptions', user?.id] });

      const today = new Date();
      const nextDate = (() => {
        for (let i = 1; i <= 14; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() + i);
          if (newDays.includes(d.getDay())) {
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
          }
        }
        return null;
      })();

      queryClient.setQueryData(['user-subscriptions', user?.id], (old: any[]) =>
        (old || []).map(sub =>
          sub.id === subId
            ? { ...sub, selected_days: newDays, ...(nextDate ? { next_delivery_date: nextDate } : {}) }
            : sub
        )
      );
    },
    onSuccess: () => {
      toast.success("Delivery schedule updated successfully!");
      
      // Invalidate ALL calendar + subscription caches so the change renders immediately
      queryClient.invalidateQueries({ queryKey: ['user-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['user-active-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['active-user-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['user-delivery-calendar'] });
      // This is the key the SubscriptionCalendar uses for JIT dot rendering
      queryClient.invalidateQueries({ queryKey: ['active-subscriptions-calendar'] });
    },
    onError: (err: any) => {
      toast.error(`Failed to update day: ${err.message}`);
      // Roll back optimistic update
      queryClient.invalidateQueries({ queryKey: ['user-subscriptions', user?.id] });
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (subId: string) => {
      // 1. Cancel the subscription row
      const { error: subErr } = await supabase
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("id", subId);
      if (subErr) throw subErr;

      // 2. Post-cleanup logistics: Cancel all upcoming pending deliveries
      const { error: delivErr } = await supabase
        .from("delivery_ledger")
        .update({ status: "cancelled" })
        .eq("subscription_id", subId)
        .eq("status", "scheduled");

      if (delivErr) {
        console.warn("Could not auto-cancel pending deliveries:", delivErr);
      }
    },
    onSuccess: () => {
      toast.success("Subscription has been cancelled.");
      queryClient.invalidateQueries({ queryKey: ["user-subscriptions", user?.id] });
    },
    onError: (err: any) => {
      toast.error(`Cancellation failed: ${err.message}`);
    }
  });

  const handleCancel = (subId: string) => {
    const ok = window.confirm(
      "⚠️ Are you absolutely sure you want to cancel this subscription? This will immediately halt all future recurring deliveries and cancel upcoming routes."
    );
    if (ok) {
      cancelMutation.mutate(subId);
    }
  };

  const handlePauseIntercept = (subId: string, status: string) => {
    if (status === "active") {
      setPauseModal({ open: true, subId, status });
    } else {
      // Resume directly
      togglePauseMutation.mutate({ subId, currentStatus: status });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center py-16 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary animate-pulse" />
        <p className="text-xs font-semibold text-muted-foreground">Retrieving subscriptions portfolio…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 bg-red-50 rounded-2xl border border-red-100 p-6 flex flex-col items-center gap-2">
        <AlertTriangle className="w-10 h-10 text-red-500" />
        <p className="font-semibold text-red-800 text-sm">Error Loading Subscriptions</p>
        <p className="text-xs text-red-600 max-w-sm">{(error as any).message}</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
        </Button>
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="text-center py-16 bg-secondary/20 rounded-3xl border border-dashed border-border/80 flex flex-col items-center px-6">
        <Calendar className="w-10 h-10 text-muted-foreground opacity-60 mb-3" />
        <p className="font-display font-bold text-brown text-base">No active subscriptions found</p>
        <p className="text-xs text-muted-foreground max-w-xs mt-1">
          Lock in special discounts and morning delivery slots by choosing an automated subscription package!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {contracts.map((sub: any) => {
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
            className={`bg-card rounded-3xl border shadow-soft overflow-hidden transition-all duration-300 ${
              sub.status === "cancelled" 
                ? "border-border/30 opacity-60 grayscale" 
                : sub.status === "paused"
                ? "border-amber-200/60 bg-amber-50/10"
                : "border-border/60 hover:border-primary/30"
            }`}
          >
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
                        className={`text-[9px] uppercase tracking-tighter ${
                          sub.status === "active" 
                            ? "bg-green-50 text-green-700 border-green-200" 
                            : sub.status === "paused"
                            ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
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
                          {addr.address_line_2 ? `, ${addr.address_line_2}` : ""}
                          {addr.landmark ? `, Near ${addr.landmark}` : ""}
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
                {/* A. Vacation Pause/Resume */}
                <Button 
                  size="sm"
                  variant={sub.status === "active" ? "secondary" : "hero"}
                  className="font-bold rounded-xl h-9"
                  disabled={togglePauseMutation.isPending}
                  onClick={() => handlePauseIntercept(sub.id, sub.status)}
                >
                  {togglePauseMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  )}
                  {sub.status === "active" ? "⏸️ Pause Subscription" : "▶️ Resume Deliveries"}
                </Button>

                {/* B. Customer Day Recalibrator */}
                {(isWeekly || isAlternate) && (
                  <div className="flex flex-col items-center sm:items-end gap-1.5 shrink-0">
                    <span className="text-[9px] text-muted-foreground uppercase font-bold">Your Delivery Days</span>
                    
                    {isAlternate && (
                      <div className="flex gap-1.5 bg-background p-1 rounded-xl border border-border/80">
                        <button
                          type="button"
                          disabled={changeDaysMutation.isPending}
                          onClick={() => changeDaysMutation.mutate({ subId: sub.id, newDays: optADays })}
                          className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-all ${
                            isOptionA
                              ? "bg-primary text-primary-foreground shadow"
                              : "bg-card hover:bg-secondary/40 text-muted-foreground"
                          }`}
                        >
                          {getDaysLabel(optADays)}
                        </button>
                        <button
                          type="button"
                          disabled={changeDaysMutation.isPending}
                          onClick={() => changeDaysMutation.mutate({ subId: sub.id, newDays: optBDays })}
                          className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-all ${
                            isOptionB
                              ? "bg-primary text-primary-foreground shadow"
                              : "bg-card hover:bg-secondary/40 text-muted-foreground"
                          }`}
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
                              className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center ${
                                isSelected
                                  ? "bg-primary text-primary-foreground shadow"
                                  : "bg-card hover:bg-secondary/40 text-muted-foreground"
                              }`}
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
      })}

      {pauseModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-sm w-full shadow-card animate-scale-in text-center space-y-4">
            <h4 className="font-display font-bold text-lg text-brown leading-tight">
              Are you sure you want to pause your fresh milk/egg deliveries?
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Pausing means you will miss out on your scheduled morning deliveries starting tomorrow. You can resume at any time from this dashboard.
            </p>
            <div className="flex flex-col gap-3 pt-2">
              <Button
                variant="hero"
                className="w-full rounded-xl font-bold shadow-yolk"
                onClick={() => setPauseModal({ open: false, subId: "", status: "" })}
              >
                Keep Deliveries Active
              </Button>
              <Button
                variant="ghost"
                className="w-full rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary/40"
                onClick={() => {
                  togglePauseMutation.mutate({ subId: pauseModal.subId, currentStatus: pauseModal.status });
                  setPauseModal({ open: false, subId: "", status: "" });
                }}
              >
                Yes, Pause My Schedule
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* D. Dark Pattern Cancellation */}
      <div className="mt-16 pt-8 border-t border-border/20">
        <details className="group opacity-40 hover:opacity-100 transition-opacity">
          <summary className="text-[10px] cursor-pointer text-muted-foreground list-none select-none text-center">
            Advanced Billing Details & Compliance
          </summary>
          <div className="mt-4 flex flex-col items-center gap-3">
            {contracts.filter(c => c.status !== "cancelled").map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleCancel(c.id)}
                disabled={cancelMutation.isPending}
                className="text-[10px] text-muted-foreground/60 hover:text-red-500 transition-colors"
              >
                Terminate agreement for {c.products?.name || c.product_slug}
              </button>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
};

export default AccountSubscriptions;
