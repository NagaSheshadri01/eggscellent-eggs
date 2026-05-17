import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Calendar, MapPin, RefreshCw, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const AccountSubscriptions = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: contracts = [], isLoading, error, refetch } = useQuery<SubscriptionContract[]>({
    queryKey: ["user-subscriptions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          *,
          addresses:address_id (address_line_1, address_line_2, landmark, city, state, pincode),
          subscription_plans:plan_id (id, title, description, frequency_type, custom_days, price_per_delivery)
        `)
        .eq("user_id", user.id)
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
      qc.invalidateQueries({ queryKey: ["user-subscriptions", user?.id] });
    },
    onError: (err: any) => {
      toast.error(`Operation failed: ${err.message}`);
    }
  });

  const changeDaysMutation = useMutation({
    mutationFn: async ({ subId, newDays }: { subId: string; newDays: number[] }) => {
      const { error } = await supabase
        .from("subscriptions")
        .update({ selected_days: newDays })
        .eq("id", subId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Delivery schedule successfully updated!");
      qc.invalidateQueries({ queryKey: ["user-subscriptions", user?.id] });
    },
    onError: (err: any) => {
      toast.error(`Failed to update day: ${err.message}`);
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
        .from("subscription_deliveries")
        .update({ status: "cancelled" })
        .eq("subscription_id", subId)
        .eq("status", "pending");

      if (delivErr) {
        console.warn("Could not auto-cancel pending deliveries:", delivErr);
      }
    },
    onSuccess: () => {
      toast.success("Subscription has been cancelled.");
      qc.invalidateQueries({ queryKey: ["user-subscriptions", user?.id] });
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
      {contracts.map((sub) => {
        const plan = sub.subscription_plans || {
          title: `Custom Package (${sub.product_slug})`,
          description: "Structured subscription deliveries",
          frequency_type: sub.selected_days.length === 7 ? "daily" : "weekly",
          price_per_delivery: 0
        };
        const addr = sub.addresses;
        const isWeekly = plan.frequency_type === "weekly";
        const isAlternate = plan.frequency_type === "alternate";

        // Resolve Option A / Option B days for alternate
        let optADays = [1, 3, 5, 0];
        let optBDays = [2, 4, 6];
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
            <div className="p-5 sm:p-6 border-b border-border/40">
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
                      {sub.status}
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

            {/* Actions row */}
            {sub.status !== "cancelled" && (
              <div className="px-5 py-4 bg-secondary/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* A. Vacation Pause/Resume */}
                <Button 
                  size="sm"
                  variant={sub.status === "active" ? "secondary" : "hero"}
                  className="font-bold rounded-xl h-9"
                  disabled={togglePauseMutation.isPending}
                  onClick={() => togglePauseMutation.mutate({ subId: sub.id, currentStatus: sub.status })}
                >
                  {togglePauseMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  )}
                  {sub.status === "active" ? "⏸️ Pause Subscription" : "▶️ Resume Deliveries"}
                </Button>

                {/* B. Customer Day Recalibrator */}
                {(isWeekly || isAlternate) && (
                  <div className="flex flex-col items-center sm:items-end gap-1.5 shrink-0">
                    <span className="text-[9px] text-muted-foreground uppercase font-bold">Recalibrate Delivery Schedule</span>
                    
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

                {/* C. Immediate Cancellation */}
                <button
                  type="button"
                  onClick={() => handleCancel(sub.id)}
                  disabled={cancelMutation.isPending}
                  className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline transition-colors mt-1 sm:mt-0"
                >
                  Cancel Subscription
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AccountSubscriptions;
