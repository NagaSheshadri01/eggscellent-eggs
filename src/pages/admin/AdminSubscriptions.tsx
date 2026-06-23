import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Repeat, Truck, Calendar, User, Package, MapPin, CheckCircle2, Plus } from "lucide-react";
import { handleSubscriptionPause, handleSubscriptionResume } from "@/lib/subscriptionUtils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const AdminSubscriptions = () => {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("dispatch");

  // Plan Creator Form State
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [productSlug, setProductSlug] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [frequencyType, setFrequencyType] = useState<"daily" | "alternate" | "weekly" | "custom_days">("daily");
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [selectedDaysA, setSelectedDaysA] = useState<number[]>([1, 3, 5, 0]);
  const [selectedDaysB, setSelectedDaysB] = useState<number[]>([2, 4, 6]);
  const [pricePerDelivery, setPricePerDelivery] = useState(0);

  // Fetch Delivery Partners for assignment
  const { data: partners = [] } = useQuery({
    queryKey: ["delivery-partners-approved"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_partners")
        .select("*")
        .eq("status", "approved")
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch Active Products for Plan Binding
  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["admin-products-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, slug")
        .eq("active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Tab 1: Active Subscription Contracts
  const subscriptionsQ = useQuery({
    queryKey: ["admin-subscriptions-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subscriptions")
        .select(`
          *,
          profiles:user_id (full_name, email, phone),
          subscription_items(id, product_slug, quantity, selected_days)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Tab 2: Today's Dispatch Queue
  const today = new Date().toISOString().split("T")[0];
  const dispatchQ = useQuery({
    queryKey: ["admin-subscription-dispatch", today],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subscription_calendar_ledger")
        .select(`
          *,
          subscription_items (
            product_slug,
            quantity,
            subscriptions (
              user_id,
              profiles:user_id (full_name, phone),
              addresses:address_id (*)
            )
          )
        `)
        .eq("delivery_date", today);
      if (error) throw error;
      return data;
    },
  });

  // Tab 3: Subscription Plans Catalog
  const plansQ = useQuery({
    queryKey: ["admin-subscription-plans"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subscription_plans")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Mutations
  const updateSubStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      if (status === "paused") {
        await handleSubscriptionPause(supabase, id);
      } else if (status === "active") {
        await handleSubscriptionResume(supabase, id);
      } else {
        const { error } = await (supabase as any).from("subscriptions").update({ status }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Subscription status updated");
      qc.invalidateQueries({ queryKey: ["admin-subscriptions-all"] });
    },
  });

  const assignPartner = useMutation({
    mutationFn: async ({ deliveryId, partnerId }: { deliveryId: string; partnerId: string }) => {
      const { data, error } = await (supabase as any)
        .from("subscription_calendar_ledger")
        .update({ delivery_partner_id: partnerId === "unassigned" ? null : partnerId })
        .eq("id", deliveryId)
        .select("id");
      if (error) throw error;
      if (data && data.length === 0) throw new Error("Assignment failed: No rows updated (Permission denied?)");
    },
    onSuccess: () => {
      toast.success("Delivery partner assigned");
      qc.invalidateQueries({ queryKey: ["admin-subscription-dispatch"] });
    },
  });

  const createPlan = useMutation({
    mutationFn: async (plan: {
      title: string;
      description: string;
      product_slug: string;
      quantity: number;
      frequency_type: string;
      custom_days: number[];
      price_per_delivery: number;
      is_active: boolean;
    }) => {
      const { error } = await (supabase as any)
        .from("subscription_plans")
        .insert(plan);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subscription plan published successfully!");
      qc.invalidateQueries({ queryKey: ["admin-subscription-plans"] });
    },
    onError: (err: any) => {
      toast.error("Failed to create plan: " + err.message);
    },
  });

  const updatePlan = useMutation({
    mutationFn: async (plan: {
      id: string;
      title: string;
      description: string;
      product_slug: string;
      quantity: number;
      frequency_type: string;
      custom_days: number[];
      price_per_delivery: number;
      is_active: boolean;
    }) => {
      const { data, error } = await (supabase as any)
        .from("subscription_plans")
        .update({
          title: plan.title,
          description: plan.description,
          product_slug: plan.product_slug,
          quantity: plan.quantity,
          frequency_type: plan.frequency_type,
          custom_days: plan.custom_days,
          price_per_delivery: plan.price_per_delivery,
          is_active: plan.is_active,
        })
        .eq("id", plan.id)
        .select();
      
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("No rows matched the ID or you don't have update permissions.");
      }
    },
    onSuccess: () => {
      toast.success("Subscription plan updated successfully!");
      qc.invalidateQueries({ queryKey: ["admin-subscription-plans"] });
    },
    onError: (err: any) => {
      toast.error("Failed to update plan: " + err.message);
    },
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any)
        .from("subscription_plans")
        .delete()
        .eq("id", id)
        .select();
      
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("No rows matched the ID or you don't have delete permissions.");
      }
    },
    onSuccess: () => {
      toast.success("Subscription plan deleted successfully");
      qc.invalidateQueries({ queryKey: ["admin-subscription-plans"] });
    },
    onError: (err: any) => {
      toast.error("Failed to delete plan: " + err.message);
    },
  });

  const togglePlanActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from("subscription_plans")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plan visibility updated");
      qc.invalidateQueries({ queryKey: ["admin-subscription-plans"] });
    },
    onError: (err: any) => {
      toast.error("Failed to update status: " + err.message);
    },
  });

  // Priority Sorting Logic for Dispatch
  const sortedDispatch = useMemo(() => {
    if (!dispatchQ.data) return [];
    return [...dispatchQ.data].sort((a, b) => {
      const aAssigned = !!a.delivery_partner_id;
      const bAssigned = !!b.delivery_partner_id;
      if (aAssigned !== bAssigned) return aAssigned ? 1 : -1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [dispatchQ.data]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-brown text-3xl tracking-tight">Subscription Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage recurring customer contracts, daily delivery fulfillment, and structured plans.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-secondary/40 p-1 mb-6">
          <TabsTrigger value="dispatch" className="flex items-center gap-2">
            <Truck className="w-4 h-4" /> Today's Dispatch
          </TabsTrigger>
          <TabsTrigger value="contracts" className="flex items-center gap-2">
            <Repeat className="w-4 h-4" /> Active Subscriptions
          </TabsTrigger>
          <TabsTrigger value="plans" className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Manage Plans
          </TabsTrigger>
        </TabsList>

        {/* ── TAB: TODAY'S DISPATCH ── */}
        <TabsContent value="dispatch" className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-brown">
              <Calendar className="w-4 h-4 text-primary" />
              Queue for {new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}
            </div>
            <div className="text-[10px] uppercase font-bold text-muted-foreground flex gap-3">
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400" /> Unassigned</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-400" /> Assigned</span>
            </div>
          </div>

          {dispatchQ.isLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Skeleton className="h-40 rounded-2xl" />
              <Skeleton className="h-40 rounded-2xl" />
            </div>
          ) : dispatchQ.error ? (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-2xl mb-6 text-sm">
              <p className="font-bold">Error loading dispatch queue:</p>
              <p>{(dispatchQ.error as any).message || "Unknown error"}</p>
            </div>
          ) : sortedDispatch.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border flex flex-col items-center">
              <CheckCircle2 className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No deliveries scheduled for today.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedDispatch.map((d: any) => {
                const subItem = d.subscription_items || {};
                const sub = subItem.subscriptions || {};
                const profile = sub.profiles || {};
                const addr = sub.addresses || {};
                const isAssigned = !!d.delivery_partner_id;

                return (
                  <div 
                    key={d.id} 
                    className={`rounded-2xl border p-4 shadow-soft transition-all ${
                      isAssigned 
                        ? "bg-green-50/60 border-green-200 hover:bg-green-50" 
                        : "bg-red-50/60 border-red-200 hover:bg-red-50 ring-1 ring-red-100"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2 font-display font-bold text-brown text-sm">
                        <User className="w-3.5 h-3.5 text-primary" />
                        {profile.full_name || "Guest Customer"}
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-white/60 px-1.5 py-0.5 rounded border border-black/5">
                        #{d.id.slice(0,8)}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-xs text-brown font-medium">
                        <Package className="w-3 h-3" />
                        {subItem.quantity || d.quantity}x {products.find((p: any) => p.slug === subItem.product_slug || p.slug === d.product_slug)?.name || subItem.product_slug || d.product_slug}
                      </div>
                      <div className="flex items-start gap-2 text-[10px] text-muted-foreground leading-relaxed">
                        <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                        {addr.address_line_1 || "No Address"}, {addr.pincode || ""}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-black/5">
                      <label className="text-[9px] font-bold uppercase text-muted-foreground mb-1 block">Assign Partner</label>
                      <Select 
                        value={d.delivery_partner_id || "unassigned"} 
                        onValueChange={(v) => assignPartner.mutate({ deliveryId: d.id, partnerId: v })}
                      >
                        <SelectTrigger className="h-8 text-[10px] bg-white/80 border-black/5">
                          <SelectValue placeholder="Choose partner..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">-- Unassigned --</SelectItem>
                          {partners.filter((p: any) => p.user_id).map((p: any) => (
                            <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── TAB: ACTIVE CONTRACTS ── */}
        <TabsContent value="contracts">
          <div className="bg-card rounded-2xl shadow-soft border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/60 text-xs uppercase text-muted-foreground font-bold border-b border-border">
                  <tr>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Subscription Plan</th>
                    <th className="px-5 py-4">Days</th>
                    <th className="px-5 py-4">Next Delivery</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {subscriptionsQ.isLoading ? (
                    [1, 2, 3].map(i => (
                      <tr key={i}><td colSpan={6} className="p-5"><Skeleton className="h-4 w-full" /></td></tr>
                    ))
                  ) : subscriptionsQ.error ? (
                    <tr>
                      <td colSpan={6} className="p-5 text-center text-destructive bg-destructive/10">
                        Error loading subscriptions: {(subscriptionsQ.error as any).message}
                      </td>
                    </tr>
                  ) : (subscriptionsQ.data || []).map((s: any) => (
                    <tr key={s.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-brown">{s.profiles?.full_name}</div>
                        <div className="text-[10px] text-muted-foreground">{s.profiles?.phone}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-2">
                        {s.subscription_items?.map((item: any) => (
                          <div key={item.id} className="flex items-center gap-1.5 font-medium text-brown">
                            <Package className="w-3.5 h-3.5 text-primary" />
                            {item.quantity}x {products.find((p: any) => p.slug === item.product_slug)?.name || item.product_slug}
                          </div>
                        ))}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-2">
                        {s.subscription_items?.map((item: any) => {
                          const days = typeof item.selected_days === "string" ? JSON.parse(item.selected_days) : (item.selected_days || []);
                          return (
                          <div key={item.id} className="flex gap-1">
                            {DAYS.map((day, idx) => (
                              <span 
                                key={day} 
                                className={`text-[9px] font-bold w-6 h-6 rounded-full flex items-center justify-center border ${
                                  days.includes(idx) || days.includes(String(idx))
                                    ? "bg-primary/20 border-primary text-brown" 
                                    : "bg-secondary/40 border-border text-muted-foreground"
                                }`}
                              >
                                {day[0]}
                              </span>
                            ))}
                          </div>
                        )})}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-brown">
                        {s.next_delivery_date ? new Date(s.next_delivery_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          s.status === 'active' ? 'bg-success/10 text-success' :
                          s.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Select 
                          value={s.status} 
                          onValueChange={(v) => updateSubStatus.mutate({ id: s.id, status: v })}
                        >
                          <SelectTrigger className="h-8 w-32 text-[10px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="paused">Paused</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB: MANAGE PLANS ── */}
        <TabsContent value="plans" className="space-y-6 pt-2">
          <div className="grid md:grid-cols-[1.2fr_1.8fr] gap-6 items-start">
            {/* PLAN CREATION FORM */}
            <div 
              id="plan-creator-form"
              className={`bg-card rounded-2xl border p-6 space-y-4 shadow-soft transition-all duration-500 ${
                editingPlanId 
                  ? "border-primary ring-2 ring-primary/20 shadow-lg scale-[1.01]" 
                  : "border-border"
              }`}
            >
              <h2 className="font-display font-bold text-brown text-lg flex items-center gap-2">
                {editingPlanId ? "✏️ Edit Subscription Plan" : <><Plus className="w-5 h-5 text-primary" /> Create & Publish Plan</>}
              </h2>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="title" className="text-xs font-bold text-muted-foreground uppercase">Plan Title</Label>
                  <Input 
                    id="title" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                    placeholder="e.g., Daily Fresh Eggs Pack" 
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-xs font-bold text-muted-foreground uppercase">Description</Label>
                  <textarea 
                    id="description" 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    placeholder="e.g., Get 12 fresh family-pack eggs delivered before 8 AM" 
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="product" className="text-xs font-bold text-muted-foreground uppercase">Bind to Product</Label>
                    <Select value={productSlug} onValueChange={setProductSlug}>
                      <SelectTrigger id="product" className="mt-1">
                        <SelectValue placeholder="Select product..." />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p: any) => (
                          <SelectItem key={p.slug} value={p.slug}>
                            {p.name || p.slug}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="quantity" className="text-xs font-bold text-muted-foreground uppercase">Quantity</Label>
                    <Input 
                      id="quantity" 
                      type="number" 
                      min={1} 
                      value={quantity} 
                      onChange={(e) => setQuantity(Number(e.target.value))} 
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="frequency" className="text-xs font-bold text-muted-foreground uppercase">Frequency</Label>
                    <Select 
                      value={frequencyType} 
                      onValueChange={(v: any) => {
                        setFrequencyType(v);
                        if (v === "daily") setSelectedDays([0,1,2,3,4,5,6]);
                        else if (v === "alternate") {
                          setSelectedDaysA([1, 3, 5, 0]);
                          setSelectedDaysB([2, 4, 6]);
                        }
                        else setSelectedDays([]);
                      }}
                    >
                      <SelectTrigger id="frequency" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="alternate">Alternate Days</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="custom_days">Custom Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="price" className="text-xs font-bold text-muted-foreground uppercase">Price Per Delivery</Label>
                    <Input 
                      id="price" 
                      type="number" 
                      step="0.01" 
                      min={0} 
                      value={pricePerDelivery || ""} 
                      onChange={(e) => setPricePerDelivery(Number(e.target.value))} 
                      placeholder="e.g., 99.00"
                      className="mt-1"
                    />
                  </div>
                </div>

                {frequencyType === "alternate" && (
                  <div className="space-y-4 pt-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground uppercase">Option A Delivery Days</Label>
                      <div className="flex justify-between gap-1 mt-1 bg-secondary/20 p-2 rounded-xl border">
                        {DAYS.map((day, idx) => {
                          const isSelected = selectedDaysA.includes(idx);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                setSelectedDaysA(prev => 
                                  prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]
                                );
                              }}
                              className={`w-8 h-8 rounded-full text-xs font-bold transition-all border flex items-center justify-center ${
                                isSelected 
                                  ? "bg-primary border-primary text-primary-foreground shadow" 
                                  : "bg-card border-border text-muted-foreground hover:bg-secondary/40"
                              }`}
                            >
                              {day[0]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground uppercase">Option B Delivery Days</Label>
                      <div className="flex justify-between gap-1 mt-1 bg-secondary/20 p-2 rounded-xl border">
                        {DAYS.map((day, idx) => {
                          const isSelected = selectedDaysB.includes(idx);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                setSelectedDaysB(prev => 
                                  prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]
                                );
                              }}
                              className={`w-8 h-8 rounded-full text-xs font-bold transition-all border flex items-center justify-center ${
                                isSelected 
                                  ? "bg-primary border-primary text-primary-foreground shadow" 
                                  : "bg-card border-border text-muted-foreground hover:bg-secondary/40"
                              }`}
                            >
                              {day[0]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {frequencyType === "custom_days" && (
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">Select Delivery Days</Label>
                    <div className="flex justify-between gap-1 mt-1 bg-secondary/20 p-2 rounded-xl border">
                      {DAYS.map((day, idx) => {
                        const isSelected = selectedDays.includes(idx);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              setSelectedDays(prev => 
                                prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]
                              );
                            }}
                            className={`w-8 h-8 rounded-full text-xs font-bold transition-all border flex items-center justify-center ${
                              isSelected 
                                ? "bg-primary border-primary text-primary-foreground shadow" 
                                : "bg-card border-border text-muted-foreground hover:bg-secondary/40"
                            }`}
                          >
                            {day[0]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  {editingPlanId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingPlanId(null);
                        setTitle("");
                        setDescription("");
                        setProductSlug("");
                        setQuantity(1);
                        setFrequencyType("daily");
                        setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
                        setSelectedDaysA([1, 3, 5, 0]);
                        setSelectedDaysB([2, 4, 6]);
                        setPricePerDelivery(0);
                      }}
                      className="flex-1 font-bold h-11"
                    >
                      Cancel Edit
                    </Button>
                  )}
                  <Button 
                    onClick={() => {
                      if (!title.trim()) {
                        toast.error("Please enter a plan title");
                        return;
                      }
                      if (!productSlug) {
                        toast.error("Please select a product");
                        return;
                      }
                      if (pricePerDelivery <= 0) {
                        toast.error("Please enter a valid price per delivery");
                        return;
                      }
                      if (frequencyType === "custom_days" && selectedDays.length === 0) {
                        toast.error("Please select at least one delivery day");
                        return;
                      }
                      if (frequencyType === "alternate" && (selectedDaysA.length === 0 || selectedDaysB.length === 0)) {
                        toast.error("Please select at least one delivery day for both Option A and Option B");
                        return;
                      }

                      const computedDays = frequencyType === "daily" 
                        ? [0, 1, 2, 3, 4, 5, 6] 
                        : frequencyType === "alternate" 
                        ? [...selectedDaysA, -1, ...selectedDaysB] 
                        : frequencyType === "weekly"
                        ? []
                        : selectedDays;

                      if (editingPlanId) {
                        updatePlan.mutate({
                          id: editingPlanId,
                          title,
                          description,
                          product_slug: productSlug,
                          quantity: Number(quantity),
                          frequency_type: frequencyType,
                          custom_days: computedDays,
                          price_per_delivery: Number(pricePerDelivery),
                          is_active: true
                        }, {
                          onSuccess: () => {
                            setEditingPlanId(null);
                            setTitle("");
                            setDescription("");
                            setProductSlug("");
                            setQuantity(1);
                            setFrequencyType("daily");
                            setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
                            setSelectedDaysA([1, 3, 5, 0]);
                            setSelectedDaysB([2, 4, 6]);
                            setPricePerDelivery(0);
                          }
                        });
                      } else {
                        createPlan.mutate({
                          title,
                          description,
                          product_slug: productSlug,
                          quantity: Number(quantity),
                          frequency_type: frequencyType,
                          custom_days: computedDays,
                          price_per_delivery: Number(pricePerDelivery),
                          is_active: true
                        }, {
                          onSuccess: () => {
                            setTitle("");
                            setDescription("");
                            setProductSlug("");
                            setQuantity(1);
                            setFrequencyType("daily");
                            setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
                            setSelectedDaysA([1, 3, 5, 0]);
                            setSelectedDaysB([2, 4, 6]);
                            setPricePerDelivery(0);
                          }
                        });
                      }
                    }}
                    disabled={createPlan.isPending || updatePlan.isPending}
                    className="flex-1 bg-primary text-primary-foreground font-bold h-11"
                  >
                    {editingPlanId ? "Update Plan" : "Create & Publish Plan"}
                  </Button>
                </div>
              </div>
            </div>

            {/* ACTIVE PLANS LIST */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-brown text-lg">Active Published Plans</h2>
                <span className="text-xs font-mono font-bold text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded border">
                  {(plansQ.data ?? []).length} Plans
                </span>
              </div>

              {plansQ.isLoading ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  <Skeleton className="h-44 rounded-2xl" />
                  <Skeleton className="h-44 rounded-2xl" />
                </div>
              ) : plansQ.error ? (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-2xl text-sm">
                  Error loading subscription plans: {(plansQ.error as any).message}
                </div>
              ) : (plansQ.data ?? []).length === 0 ? (
                <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border flex flex-col items-center">
                  <Repeat className="w-10 h-10 text-muted-foreground mb-2 opacity-30" />
                  <p className="font-bold text-brown text-sm">No subscription plans published yet</p>
                  <p className="text-xs text-muted-foreground">Use the creator form to publish your first structured plan.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {(plansQ.data ?? []).map((plan: any) => {
                    const mappedDays = plan.custom_days || [];
                    return (
                      <div 
                        key={plan.id} 
                        className={`rounded-2xl border p-5 bg-card shadow-soft transition-all space-y-4 ${
                          plan.is_active 
                            ? "border-border" 
                            : "border-border bg-muted/40 opacity-70"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <h3 className="font-display font-bold text-brown text-base leading-tight">
                              {plan.title}
                            </h3>
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              Slug: {plan.product_slug}
                            </p>
                          </div>
                          
                          <button
                            onClick={() => {
                              togglePlanActive.mutate({ id: plan.id, is_active: !plan.is_active });
                            }}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all border ${
                              plan.is_active 
                                ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100" 
                                : "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                            }`}
                          >
                            {plan.is_active ? "Active" : "Inactive"}
                          </button>
                        </div>

                        {plan.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {plan.description}
                          </p>
                        )}

                        <div className="grid grid-cols-2 gap-3 text-xs pt-1 border-t border-border/40">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-muted-foreground block">Deliveries</span>
                            <span className="font-bold text-brown flex items-center gap-1 mt-0.5">
                              <Package className="w-3.5 h-3.5 text-primary" />
                              {plan.quantity}x {products.find((p: any) => p.slug === plan.product_slug)?.name || plan.product_slug}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase font-bold text-muted-foreground block">Cost Stop</span>
                            <span className="font-bold text-primary text-sm block mt-0.5">
                              ₹{Number(plan.price_per_delivery).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {plan.frequency_type === "alternate" ? (
                          <div className="space-y-2">
                            <div className="space-y-1">
                              <span className="text-[9px] uppercase font-bold text-muted-foreground block">Option A Schedule</span>
                              <div className="flex gap-1">
                                {(() => {
                                  const dividerIndex = mappedDays.indexOf(-1);
                                  const optA = dividerIndex === -1 ? mappedDays : mappedDays.slice(0, dividerIndex);
                                  return DAYS.map((day, idx) => (
                                    <span 
                                      key={day} 
                                      className={`text-[9px] font-bold w-6 h-6 rounded-full flex items-center justify-center border ${
                                        optA.includes(idx) 
                                          ? "bg-primary/25 border-primary text-brown" 
                                          : "bg-secondary/40 border-border text-muted-foreground"
                                      }`}
                                    >
                                      {day[0]}
                                    </span>
                                  ));
                                })()}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] uppercase font-bold text-muted-foreground block">Option B Schedule</span>
                              <div className="flex gap-1">
                                {(() => {
                                  const dividerIndex = mappedDays.indexOf(-1);
                                  const optB = dividerIndex === -1 ? [2, 4, 6] : mappedDays.slice(dividerIndex + 1);
                                  return DAYS.map((day, idx) => (
                                    <span 
                                      key={day} 
                                      className={`text-[9px] font-bold w-6 h-6 rounded-full flex items-center justify-center border ${
                                        optB.includes(idx) 
                                          ? "bg-primary/25 border-primary text-brown" 
                                          : "bg-secondary/40 border-border text-muted-foreground"
                                      }`}
                                    >
                                      {day[0]}
                                    </span>
                                  ));
                                })()}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground block">Weekly Delivery Schedule</span>
                            <div className="flex gap-1.5">
                              {DAYS.map((day, idx) => (
                                <span 
                                  key={day} 
                                  className={`text-[9px] font-bold w-6 h-6 rounded-full flex items-center justify-center border ${
                                    mappedDays.includes(idx) 
                                      ? "bg-primary/25 border-primary text-brown" 
                                      : "bg-secondary/40 border-border text-muted-foreground"
                                  }`}
                                >
                                  {day[0]}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 pt-3 border-t border-border/40">
                          <button
                            onClick={() => {
                              setEditingPlanId(plan.id);
                              setTitle(plan.title || "");
                              setDescription(plan.description || "");
                              setProductSlug(plan.product_slug || "");
                              setQuantity(plan.quantity || 1);
                              setFrequencyType(plan.frequency_type || "daily");
                              setSelectedDays(plan.custom_days || [0, 1, 2, 3, 4, 5, 6]);
                              if (plan.frequency_type === "alternate") {
                                const days = plan.custom_days || [];
                                const dividerIndex = days.indexOf(-1);
                                if (dividerIndex !== -1) {
                                  setSelectedDaysA(days.slice(0, dividerIndex));
                                  setSelectedDaysB(days.slice(dividerIndex + 1));
                                } else {
                                  setSelectedDaysA(days);
                                  setSelectedDaysB([2, 4, 6]);
                                }
                              } else {
                                setSelectedDaysA([1, 3, 5, 0]);
                                setSelectedDaysB([2, 4, 6]);
                              }
                              setPricePerDelivery(plan.price_per_delivery || 0);
                              document.getElementById("plan-creator-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
                              toast.info(`Editing plan "${plan.title}"`);
                            }}
                            className="flex-1 py-1.5 rounded-lg bg-secondary text-brown hover:bg-secondary/80 text-[10px] font-bold transition-all text-center"
                          >
                            ✏️ Edit Plan
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete the plan "${plan.title}"?`)) {
                                deletePlan.mutate(plan.id);
                              }
                            }}
                            disabled={deletePlan.isPending}
                            className="flex-1 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-[10px] font-bold transition-all text-center border border-red-200"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSubscriptions;
