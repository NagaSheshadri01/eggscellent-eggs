import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import {
  Navigation,
  Truck,
  Repeat,
  User,
  Package,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Calendar,
  DollarSign,
  Sliders,
  ShieldCheck,
  Search,
  ChevronRight,
  TrendingUp
} from "lucide-react";

export const AdminLogistics = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("tomorrow-dispatch");

  // Filter Date: Tomorrow
  const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd");

  // Selection state for checkbox bulk matching
  const [selectedLedgerIds, setSelectedLedgerIds] = useState<string[]>([]);
  const [targetPartnerId, setTargetPartnerId] = useState<string>("");

  // Customer override state
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");

  // --- QUERY 1: Tomorrow's Scheduled Deliveries ---
  const tomorrowDispatchQ = useQuery({
    queryKey: ["tomorrow-dispatch-manifest", tomorrowStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_ledger")
        .select(`
          *,
          subscriptions:subscription_id (
            id,
            product_slug,
            quantity,
            profiles:user_id (id, full_name, phone, email),
            addresses:address_id (*)
          )
        `)
        .eq("delivery_date", tomorrowStr)
        .eq("status", "scheduled");

      if (error) throw error;
      return data || [];
    }
  });

  // --- QUERY 2: Active Approved Partners ---
  const partnersQ = useQuery({
    queryKey: ["partners-active-approved"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_partners")
        .select("user_id, full_name, active, status")
        .eq("status", "approved");
      if (error) throw error;
      return data || [];
    }
  });

  // --- QUERY 3: Customers with Wallets & Subscriptions ---
  const customersQ = useQuery({
    queryKey: ["admin-logistics-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          phone,
          email,
          wallets (id, balance),
          subscriptions (*)
        `);
      if (error) throw error;
      return data || [];
    }
  });

  // --- MUTATION 1: Bulk Assign Driver ---
  const bulkAssignMutation = useMutation({
    mutationFn: async ({ ledgerIds, partnerId }: { ledgerIds: string[]; partnerId: string }) => {
      const { error } = await supabase
        .from("delivery_ledger")
        .update({ delivery_partner_id: partnerId === "unassigned" ? null : partnerId })
        .in("id", ledgerIds);

      if (error) throw error;
      return { ledgerIds, partnerId };
    },
    onSuccess: (data) => {
      toast.success(`Assigned ${data.ledgerIds.length} stops successfully!`);
      queryClient.invalidateQueries({ queryKey: ["tomorrow-dispatch-manifest", tomorrowStr] });
      setSelectedLedgerIds([]); // Reset selection
      setTargetPartnerId(""); // Reset partner selection
    },
    onError: (err: any) => {
      toast.error("Bulk assignment failed: " + err.message);
    }
  });

  // --- MUTATION 2: Wallet Override Adjustment ---
  const walletAdjustmentMutation = useMutation({
    mutationFn: async ({ walletId, amount, reason }: { walletId: string; amount: number; reason: string }) => {
      const { error } = await supabase
        .from("wallet_transactions")
        .insert({
          wallet_id: walletId,
          amount,
          transaction_type: "admin_adjustment",
          reference_id: `Admin Override: ${reason}`
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Wallet adjustment applied successfully!");
      queryClient.invalidateQueries({ queryKey: ["admin-logistics-customers"] });
      setAdjustmentAmount("");
      setAdjustmentReason("");
    },
    onError: (err: any) => {
      toast.error("Failed to adjust wallet balance: " + err.message);
    }
  });

  // --- MUTATION 3: Subscription Contract Override Toggle (Active/Paused) ---
  const toggleSubStatusMutation = useMutation({
    mutationFn: async ({ subId, newStatus }: { subId: string; newStatus: "active" | "paused" }) => {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: newStatus })
        .eq("id", subId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subscription contract status updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["admin-logistics-customers"] });
      queryClient.invalidateQueries({ queryKey: ["tomorrow-dispatch-manifest", tomorrowStr] });
    },
    onError: (err: any) => {
      toast.error("Failed to update subscription status: " + err.message);
    }
  });

  // --- CLUSTERING REDUCER (Pincode -> Area/Colony -> Building/Apartment) ---
  const tomorrowDeliveries = tomorrowDispatchQ.data || [];
  
  const geographicalClusters = useMemo(() => {
    const groups: Record<string, Record<string, any[]>> = {};

    tomorrowDeliveries.forEach((d: any) => {
      const sub = d.subscriptions || {};
      const addr = sub.addresses || {};
      const pincode = addr.pincode || "Unknown Pincode";
      const area = addr.landmark || addr.city || "Unknown Area";

      if (!groups[pincode]) {
        groups[pincode] = {};
      }
      if (!groups[pincode][area]) {
        groups[pincode][area] = [];
      }
      groups[pincode][area].push(d);
    });

    return groups;
  }, [tomorrowDeliveries]);

  // Selected customer computed data
  const selectedCustomerInfo = useMemo(() => {
    if (!selectedCustomerId || !customersQ.data) return null;
    return customersQ.data.find((c: any) => c.id === selectedCustomerId);
  }, [selectedCustomerId, customersQ.data]);

  // Filtered customer list for search
  const filteredCustomers = useMemo(() => {
    const list = customersQ.data || [];
    if (!customerSearchQuery.trim()) return list.slice(0, 5);
    return list.filter((c: any) =>
      c.full_name?.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
      c.phone?.includes(customerSearchQuery) ||
      c.email?.toLowerCase().includes(customerSearchQuery.toLowerCase())
    );
  }, [customerSearchQuery, customersQ.data]);

  // Checkbox toggle logic
  const handleToggleRow = (id: string) => {
    setSelectedLedgerIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleCluster = (clusterDeliveries: any[]) => {
    const clusterIds = clusterDeliveries.map((d) => d.id);
    const allSelected = clusterIds.every((id) => selectedLedgerIds.includes(id));

    if (allSelected) {
      // Remove all cluster rows
      setSelectedLedgerIds((prev) => prev.filter((id) => !clusterIds.includes(id)));
    } else {
      // Add all cluster rows (avoiding duplicates)
      setSelectedLedgerIds((prev) => {
        const unique = new Set([...prev, ...clusterIds]);
        return Array.from(unique);
      });
    }
  };

  return (
    <div className="space-y-6 pb-28">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-brown text-3xl tracking-tight">Administrative Logistics Board</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Supervise geographical clustering manifests, bulk match routes to drivers, and execute administrative wallet disputes overrides.
          </p>
        </div>
        <div className="bg-white px-4 py-2 rounded-2xl border border-border/80 flex items-center gap-2 self-start">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-brown">Manifest Date: {tomorrowStr} (Tomorrow)</span>
        </div>
      </div>

      {/* DASHBOARD TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-secondary/40 p-1 mb-6">
          <TabsTrigger value="tomorrow-dispatch" className="flex items-center gap-2">
            <Navigation className="w-4 h-4" /> Tomorrow's Route Stops
          </TabsTrigger>
          <TabsTrigger value="driver-registry" className="flex items-center gap-2">
            <Truck className="w-4 h-4" /> Active Driver Shifts
          </TabsTrigger>
          <TabsTrigger value="wallet-overrides" className="flex items-center gap-2">
            <Sliders className="w-4 h-4" /> Customer Ledger Overrides
          </TabsTrigger>
        </TabsList>

        {/* 1. TOMORROW'S ROUTE STOPS CLUSTERING VIEW */}
        <TabsContent value="tomorrow-dispatch" className="space-y-6">
          {tomorrowDispatchQ.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
            </div>
          ) : tomorrowDispatchQ.error ? (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-2xl text-sm">
              Error loading dispatch entries: {(tomorrowDispatchQ.error as any).message}
            </div>
          ) : tomorrowDeliveries.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border flex flex-col items-center">
              <CheckCircle2 className="w-12 h-12 text-muted-foreground mb-3 opacity-30" />
              <p className="font-display font-bold text-brown">No scheduled deliveries for tomorrow</p>
              <p className="text-sm text-muted-foreground mt-1">There are no upcoming scheduled subscription ledger rows for {tomorrowStr}.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-amber-50/50 border border-amber-200/50 p-4 rounded-2xl">
                <div className="text-xs font-semibold text-amber-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Select clusters or individual stops below to assign them to a delivery partner in bulk.
                </div>
                <div className="text-xs font-mono font-bold text-muted-foreground">
                  {selectedLedgerIds.length} stops selected
                </div>
              </div>

              {Object.entries(geographicalClusters).map(([pincode, areas]) => (
                <div key={pincode} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <span className="font-display font-bold text-brown text-lg">📮 Pincode: {pincode}</span>
                    <span className="text-[10px] bg-secondary text-brown font-mono font-bold px-2 py-0.5 rounded border border-border">
                      {Object.values(areas).flat().length} pending stops
                    </span>
                  </div>

                  <Accordion type="multiple" defaultValue={Object.keys(areas)} className="space-y-3 w-full">
                    {Object.entries(areas).map(([area, deliveries]) => {
                      const clusterIds = deliveries.map((d) => d.id);
                      const isAllClusterSelected = clusterIds.every((id) => selectedLedgerIds.includes(id));
                      const isSomeClusterSelected = clusterIds.some((id) => selectedLedgerIds.includes(id)) && !isAllClusterSelected;

                      return (
                        <AccordionItem
                          key={area}
                          value={area}
                          className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-soft px-4 py-2"
                        >
                          <div className="flex items-center gap-4 w-full">
                            <Checkbox
                              checked={isAllClusterSelected ? true : isSomeClusterSelected ? "indeterminate" : false}
                              onCheckedChange={() => handleToggleCluster(deliveries)}
                              className="shrink-0"
                            />
                            <AccordionTrigger className="hover:no-underline flex-1 py-3 text-left">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full pr-4">
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                                  <span className="font-display font-bold text-brown text-sm sm:text-base capitalize">
                                    {area || "General Area"}
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase bg-secondary/50 px-2 py-0.5 rounded border border-border self-start sm:self-auto">
                                  {deliveries.length} Pending Drops
                                </span>
                              </div>
                            </AccordionTrigger>
                          </div>

                          <AccordionContent className="pt-2 pb-4">
                            <div className="overflow-x-auto rounded-xl border border-border bg-white mt-2">
                              <table className="w-full text-xs text-left">
                                <thead className="bg-secondary/20 text-muted-foreground font-bold border-b border-border text-[10px] uppercase">
                                  <tr>
                                    <th className="px-4 py-3 w-10">Select</th>
                                    <th className="px-4 py-3">Customer Info</th>
                                    <th className="px-4 py-3">Fulfillment Stop Details</th>
                                    <th className="px-4 py-3">Building / Door Address</th>
                                    <th className="px-4 py-3">Assigned Driver</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {deliveries.map((d: any) => {
                                    const sub = d.subscriptions || {};
                                    const profile = sub.profiles || {};
                                    const addr = sub.addresses || {};
                                    const isAssigned = !!d.delivery_partner_id;

                                    return (
                                      <tr
                                        key={d.id}
                                        className={`hover:bg-secondary/10 transition-colors ${
                                          selectedLedgerIds.includes(d.id)
                                            ? "bg-primary/5"
                                            : isAssigned
                                            ? "bg-green-50/20"
                                            : "bg-red-50/10"
                                        }`}
                                      >
                                        <td className="px-4 py-3 text-center">
                                          <Checkbox
                                            checked={selectedLedgerIds.includes(d.id)}
                                            onCheckedChange={() => handleToggleRow(d.id)}
                                          />
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="font-semibold text-brown">{profile.full_name || "Guest User"}</div>
                                          <div className="text-[10px] text-muted-foreground">{profile.phone || "—"}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="flex items-center gap-1.5 font-medium text-brown">
                                            <Package className="w-3.5 h-3.5 text-primary shrink-0" />
                                            {sub.quantity}x {sub.product_slug}
                                          </div>
                                          <div className="text-[10px] text-muted-foreground mt-0.5">
                                            Locked Price: ₹{d.effective_price}/delivery
                                          </div>
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="font-medium text-brown capitalize">
                                            {addr.address_line_1 || "—"}
                                          </div>
                                          {addr.address_line_2 && (
                                            <div className="text-[10px] text-muted-foreground capitalize">
                                              {addr.address_line_2}
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-4 py-3">
                                          {isAssigned ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">
                                              🚚 {partnersQ.data?.find((p) => p.user_id === d.delivery_partner_id)?.full_name || "Assigned"}
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                              ⚠️ Unassigned
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 2. DRIVER REGISTRY / TOMORROW'S ASSIGNED SHIFTS SUMMARY */}
        <TabsContent value="driver-registry" className="space-y-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {partnersQ.isLoading ? (
              <Skeleton className="h-40 rounded-2xl" />
            ) : (partnersQ.data || []).length === 0 ? (
              <div className="col-span-full text-center py-10 bg-card rounded-2xl border border-dashed border-border">
                <Truck className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-30" />
                <p className="font-bold text-brown">No delivery partners found</p>
              </div>
            ) : (
              (partnersQ.data || []).map((partner: any) => {
                // Calculate assigned stops count for tomorrow
                const assignedStops = tomorrowDeliveries.filter((d) => d.delivery_partner_id === partner.user_id);
                return (
                  <div key={partner.user_id} className="bg-card rounded-2xl border border-border/80 p-5 shadow-soft hover:shadow-md transition-all space-y-4">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h3 className="font-display font-bold text-brown text-base">{partner.full_name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Driver ID: #{partner.user_id.slice(0, 8).toUpperCase()}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        partner.active ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-600"
                      }`}>
                        {partner.active ? "Active" : "Offline"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-secondary">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Tomorrow's Drops</span>
                        <div className="text-xl font-display font-bold text-brown mt-0.5">{assignedStops.length} Stops</div>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Fulfillment Status</span>
                        <div className="text-[11px] font-semibold text-primary mt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Ready for shift
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* 3. CUSTOMER LEDGER ADJUSTMENTS & CONTRACT OVERRIDES */}
        <TabsContent value="wallet-overrides" className="space-y-6">
          <div className="grid md:grid-cols-[1fr_2fr] gap-6 items-start">
            {/* Left sidebar: Customer selector */}
            <div className="bg-card rounded-2xl border border-border/80 p-5 space-y-4 shadow-soft">
              <h2 className="font-display font-bold text-brown text-base flex items-center gap-2">
                <User className="w-5 h-5 text-primary" /> Search Customer Profile
              </h2>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Enter name, phone, or email..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  className="pl-9 bg-white"
                />
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pt-2">
                {customersQ.isLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : filteredCustomers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No customers found</p>
                ) : (
                  filteredCustomers.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedCustomerId(c.id);
                        setAdjustmentAmount("");
                        setAdjustmentReason("");
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition-all text-xs flex justify-between items-center ${
                        selectedCustomerId === c.id
                          ? "bg-primary/10 border-primary font-semibold text-brown"
                          : "bg-white border-border/60 hover:bg-secondary/40 text-stone-600"
                      }`}
                    >
                      <div>
                        <div>{c.full_name || "Customer"}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{c.phone || c.email}</div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Right details pane: adjustments form and toggles */}
            <div className="space-y-6">
              {!selectedCustomerId ? (
                <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                  <Sliders className="w-12 h-12 text-muted-foreground opacity-30 mb-3" />
                  <p className="font-display font-bold text-brown">No Customer Profile Selected</p>
                  <p className="text-sm text-muted-foreground mt-1">Select a customer from the search pane to view wallet balances and contract statuses.</p>
                </div>
              ) : selectedCustomerInfo ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {/* Customer Card */}
                  <div className="bg-card rounded-2xl border border-border/80 p-6 shadow-soft space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
                      <div>
                        <h2 className="font-display font-bold text-brown text-xl">{selectedCustomerInfo.full_name}</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">{selectedCustomerInfo.email} • {selectedCustomerInfo.phone}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Prepaid Wallet Balance</span>
                        <div className="text-2xl font-display font-bold text-brown flex items-center justify-end gap-1 mt-0.5">
                          <DollarSign className="w-5 h-5 text-primary" />
                          ₹{selectedCustomerInfo.wallets?.[0]?.balance ?? "0.00"}
                        </div>
                      </div>
                    </div>

                    {/* Form: Manual Wallet Adjustment */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-primary" /> Adjust Wallet Funds Manually
                      </h3>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="adjustment-amount" className="text-xs font-bold text-muted-foreground uppercase">
                            Adjustment Amount (₹)
                          </Label>
                          <Input
                            id="adjustment-amount"
                            type="number"
                            step="0.01"
                            placeholder="e.g. 500 (Credit) or -200 (Debit)"
                            value={adjustmentAmount}
                            onChange={(e) => setAdjustmentAmount(e.target.value)}
                            className="bg-white"
                          />
                          <p className="text-[9px] text-muted-foreground">
                            Use positive numbers to add credits, negative numbers (e.g. -150) to charge/debit.
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="adjustment-reason" className="text-xs font-bold text-muted-foreground uppercase">
                            Reasoning / Dispute Log String
                          </Label>
                          <Input
                            id="adjustment-reason"
                            placeholder="e.g. Compensation for missing egg carton"
                            value={adjustmentReason}
                            onChange={(e) => setAdjustmentReason(e.target.value)}
                            className="bg-white"
                          />
                        </div>
                      </div>

                      <Button
                        variant="hero"
                        className="h-10 px-6 font-bold shadow-lg shadow-primary/20"
                        disabled={walletAdjustmentMutation.isPending}
                        onClick={() => {
                          const amt = parseFloat(adjustmentAmount);
                          if (isNaN(amt)) {
                            toast.error("Please enter a valid decimal number amount.");
                            return;
                          }
                          if (!adjustmentReason.trim()) {
                            toast.error("Please provide a reasoning log statement.");
                            return;
                          }
                          const walletId = selectedCustomerInfo.wallets?.[0]?.id;
                          if (!walletId) {
                            toast.error("No wallet found for this user.");
                            return;
                          }

                          walletAdjustmentMutation.mutate({
                            walletId,
                            amount: amt,
                            reason: adjustmentReason
                          });
                        }}
                      >
                        {walletAdjustmentMutation.isPending ? "Applying Override..." : "Apply Wallet Override"}
                      </Button>
                    </div>
                  </div>

                  {/* Customer Subscriptions Override Toggles */}
                  <div className="bg-card rounded-2xl border border-border/80 p-6 shadow-soft space-y-4">
                    <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                      <Repeat className="w-3.5 h-3.5 text-primary" /> Active Subscription Contracts
                    </h3>

                    {(!selectedCustomerInfo.subscriptions || selectedCustomerInfo.subscriptions.length === 0) ? (
                      <p className="text-xs text-muted-foreground italic">No subscriptions found for this customer.</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedCustomerInfo.subscriptions.map((sub: any) => (
                          <div
                            key={sub.id}
                            className="bg-white rounded-xl border border-border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 font-display font-bold text-brown text-sm">
                                <Package className="w-4 h-4 text-primary shrink-0" />
                                {sub.quantity}x {sub.product_slug}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                Contract ID: #{sub.id.slice(0, 8).toUpperCase()} • Created on: {new Date(sub.created_at).toLocaleDateString()}
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                sub.status === "active" ? "bg-success/10 text-success" : "bg-amber-100 text-amber-700"
                              }`}>
                                {sub.status}
                              </span>

                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs font-bold border-stone-200"
                                disabled={toggleSubStatusMutation.isPending}
                                onClick={() => {
                                  const targetStatus = sub.status === "active" ? "paused" : "active";
                                  toggleSubStatusMutation.mutate({
                                    subId: sub.id,
                                    newStatus: targetStatus
                                  });
                                }}
                              >
                                {sub.status === "active" ? "Freeze Sequence" : "Unfreeze Sequence"}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* FLOATING ACTION BAR FOR BULK ASSIGNMENT */}
      {selectedLedgerIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-300 z-50">
          <div className="bg-brown text-primary-foreground rounded-2xl shadow-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-display font-bold">
                {selectedLedgerIds.length}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm">Tomorrow's Stops Selected</span>
                <span className="text-[10px] text-primary/70">Assign bulk stops to a single delivery partner</span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto sm:max-w-xs">
              <Select value={targetPartnerId} onValueChange={setTargetPartnerId}>
                <SelectTrigger className="h-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 text-xs">
                  <SelectValue placeholder="Choose Partner..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">-- Clear Assignment --</SelectItem>
                  {(partnersQ.data || []).map((p: any) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button
                variant="hero"
                className="h-10 px-6 font-bold whitespace-nowrap"
                disabled={!targetPartnerId || bulkAssignMutation.isPending}
                onClick={() => {
                  bulkAssignMutation.mutate({
                    ledgerIds: selectedLedgerIds,
                    partnerId: targetPartnerId
                  });
                }}
              >
                {bulkAssignMutation.isPending ? "Assigning..." : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLogistics;
