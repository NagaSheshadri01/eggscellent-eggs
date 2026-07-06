import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Calendar, MapPin, RefreshCw, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Settings, PauseCircle, PlayCircle, XCircle } from "lucide-react";
import { handleSubscriptionPause, handleSubscriptionResume } from "@/lib/subscriptionUtils";
type SubscriptionContract = {
  id: string;
  display_id?: string;
  user_id: string;
  status: string;
  payment_method?: string;
  wallet_mode?: string;
  address_id: string | null;
  created_at: string;
  product_slug: string;
  quantity: number;
  frequency: string;
  selected_days: number[];
  products: {
    name: string;
    discounted_price: number | null;
    original_price: number | null;
    image_url: string | null;
  } | null;
  addresses?: {
    address_line_1: string;
    address_line_2: string | null;
    landmark: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
  } | null;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const AccountSubscriptions = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pauseModal, setPauseModal] = useState<{ open: boolean; subId: string; status: string }>({ open: false, subId: "", status: "" });
  const [cancelModal, setCancelModal] = useState<{ open: boolean; subId: string }>({ open: false, subId: "" });
  const [cancelText, setCancelText] = useState("");

  const { data: contracts = [], isLoading, error, refetch } = useQuery<SubscriptionContract[]>({
    queryKey: ["user-subscriptions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          id,
          display_id,
          status,
          created_at,
          address_id,
          payment_method,
          *,
          addresses(address_line_1, address_line_2, landmark, city, state, pincode)
        `)
        .eq("user_id", user.id)
        .in("status", ["active", "paused"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      const subs = data || [];
      
      if (subs.length === 0) return [];

      // Extract unique product slugs
      const slugs = [...new Set(subs.map(s => s.product_slug).filter(Boolean))];
      
      let productsMap = new Map();
      if (slugs.length > 0) {
        const { data: productsData } = await supabase
          .from("products")
          .select("*")
          .in("slug", slugs);
        if (productsData) {
          productsData.forEach(p => productsMap.set(p.slug, p));
        }
      }

      // Merge manually
      const mergedSubs = subs.map(sub => ({
        ...sub,
        products: productsMap.get(sub.product_slug) || null
      }));

      return mergedSubs as any[];
    },
    enabled: !!user
  });


  const togglePauseMutation = useMutation({
    mutationFn: async ({ subId, currentStatus }: { subId: string; currentStatus: string }) => {
      const nextStatus = currentStatus === "active" ? "paused" : "active";
      if (nextStatus === "paused") {
        await handleSubscriptionPause(supabase, subId);
      } else {
        await handleSubscriptionResume(supabase, subId);
      }
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

      // 1. Update selected_days on ALL items in this subscription (assuming unified schedule)
      const { error } = await (supabase as any)
        .from("subscriptions")
        .update({ selected_days: newDays })
        .eq("id", subId);

      if (error) throw error;

      // 2. Clear out future calendar ledger overrides to reset the schedule
      await (supabase as any)
        .from("subscription_calendar_ledger")
        .delete()
        .eq("subscription_id", subId)
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
      const { error: subErr } = await (supabase as any)
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("id", subId);
      if (subErr) throw subErr;

      // 2. Post-cleanup logistics: Cancel all upcoming pending deliveries
      // Cancel active scheduled items inside the operational tracking ledger
      const { error: delivErr } = await (supabase as any)
        .from("subscription_calendar_ledger")
        .insert({
          user_id: user.id,
          subscription_id: subId,
          action_type: 'skip',
          delivery_date: new Date().toISOString().split('T')[0]
        });

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
    cancelMutation.mutate(subId);
    setCancelModal({ open: false, subId: "" });
    setCancelText("");
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
        const addr = sub.addresses;
        const items = [sub];
        // Extract common selected_days / frequency from the first item (assuming bundled schedule)
        const firstItem = sub;
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
            className={`relative bg-card rounded-3xl border shadow-soft overflow-hidden transition-all duration-300 ${
              sub.status === "cancelled" 
                ? "border-border/30 opacity-60 grayscale" 
                : sub.status === "paused"
                ? "border-amber-200/60 bg-amber-50/10"
                : "border-border/60 hover:border-primary/30"
            }`}
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
                          const isSelected = commonDays.includes(idx);
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

      {cancelModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-sm w-full shadow-card animate-scale-in text-center space-y-4">
            <h4 className="font-display font-bold text-lg text-brown leading-tight">
              Cancel Subscription
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Type 'cancel' below to confirm subscription termination. This will immediately halt all future deliveries.
            </p>
            <Input 
              autoFocus
              className="mt-2 text-center" 
              placeholder="cancel" 
              value={cancelText} 
              onChange={e => setCancelText(e.target.value)} 
            />
            <div className="flex flex-col gap-3 pt-2">
              <Button
                variant="destructive"
                className="w-full rounded-xl font-bold"
                disabled={cancelText.trim().toLowerCase() !== "cancel" || cancelMutation.isPending}
                onClick={() => handleCancel(cancelModal.subId)}
              >
                {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirm Cancellation
              </Button>
              <Button
                variant="ghost"
                className="w-full rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary/40"
                onClick={() => setCancelModal({ open: false, subId: "" })}
              >
                Go Back
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountSubscriptions;
