import { useState, useMemo, useEffect } from "react";
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
  TrendingUp,
  Plus
} from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DeliveryStop {
  id: string;
  userId: string;
  customerInfo: any;
  address: any;
  assignedDriverId: string | null;
  items: Array<{
    ledgerId: string;
    productSlug: string;
    quantity: number;
    price: number;
    status: string;
    custom_order_id?: string;
  }>;
  netQuantity: number;
  custom_order_id?: string;
}

export const AdminLogistics = () => {
  const queryClient = useQueryClient();

  const updateItemStatusMutation = useMutation({
    mutationFn: async ({ ledgerId, newStatus }: { ledgerId: string; newStatus: string }) => {
      const { error } = await (supabase as any)
        .from('delivery_ledger')
        .update({ status: newStatus })
        .eq('id', ledgerId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item status adjusted successfully.");
      queryClient.invalidateQueries({ queryKey: ["admin-logistics-manifest-today"] });
      queryClient.invalidateQueries({ queryKey: ["tomorrow-dispatch-manifest"] });
    }
  });

  const [activeTab, setActiveTab] = useState("tomorrow-dispatch");

  const getLocalDateString = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTomorrowString = () => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return getLocalDateString(t);
  };

  const [todayStr, setTodayStr] = useState(getLocalDateString());
  const [tomorrowStr, setTomorrowStr] = useState(getTomorrowString());

  useEffect(() => {
    const handleVisibilitySync = () => {
      if (document.visibilityState === 'visible') {
        const trueToday = getLocalDateString();
        const trueTomorrow = getTomorrowString();
        if (trueToday !== todayStr) {
          setTodayStr(trueToday);
          setTomorrowStr(trueTomorrow);
          queryClient.invalidateQueries({ queryKey: ["admin-logistics-manifest-today"] });
          queryClient.invalidateQueries({ queryKey: ["tomorrow-dispatch-manifest"] });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilitySync);
    return () => document.removeEventListener('visibilitychange', handleVisibilitySync);
  }, [todayStr, queryClient]);

  const [adminManifestTab, setAdminManifestTab] = useState<'today' | 'tomorrow'>('today');

  // Selection state for checkbox bulk matching
  const [selectedLedgerIds, setSelectedLedgerIds] = useState<string[]>([]);
  const [targetPartnerId, setTargetPartnerId] = useState<string>("");

  // Customer override state
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");

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

  // --- QUERY 1A: Today's Live Operations Manifest ---
  const todayDispatchQ = useQuery({
    queryKey: ["admin-logistics-manifest-today", todayStr],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("master_orders")
        .select(`
          *,
          profiles:user_id (id, full_name, phone, email),
          delivery_ledger (
            *,
            subscriptions:subscription_id (
              id,
              product_slug,
              quantity,
              addresses:address_id (*)
            )
          )
        `)
        .eq("delivery_date", todayStr);
      
      if (error) throw error;
      return data || [];
    }
  });

  // --- QUERY 1B: Tomorrow's Planning Manifest ---
  const tomorrowDispatchQ = useQuery({
    queryKey: ["tomorrow-dispatch-manifest", tomorrowStr],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("master_orders")
        .select(`
          *,
          profiles:user_id (id, full_name, phone, email),
          delivery_ledger (
            *,
            subscriptions:subscription_id (
              id,
              product_slug,
              quantity,
              addresses:address_id (*)
            )
          )
        `)
        .eq("delivery_date", tomorrowStr);

      if (error) throw error;
      return data || [];
    }
  });

  // --- QUERY 2: Active Approved Partners ---
  const partnersQ = useQuery({
    queryKey: ["partners-active-approved"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
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
      const { data, error } = await (supabase as any)
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

  // --- QUERY 4: Active Products for Plan Binding ---
  const { data: products = [] } = useQuery({
    queryKey: ["admin-products-active"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("products")
        .select("id, name, slug")
        .eq("active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // --- QUERY 5: Active Subscription Contracts ---
  const subscriptionsQ = useQuery({
    queryKey: ["admin-subscriptions-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subscriptions")
        .select(`
          *,
          profiles:user_id (full_name, email, phone)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // --- QUERY 6: Subscription Plans Catalog ---
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

  // --- MUTATION 1: Bulk Assign Driver ---
  const bulkAssignMutation = useMutation({
    mutationFn: async ({ ledgerIds, partnerId }: { ledgerIds: string[]; partnerId: string }) => {
      const selectedDriverId = partnerId === "unassigned" ? null : partnerId;
      const extractedLedgerIdsArray = ledgerIds;
      const { data, error } = await (supabase as any)
        .from('delivery_ledger')
        .update({ delivery_partner_id: selectedDriverId })
        .in('id', extractedLedgerIdsArray)
        .select('id');

      if (error) throw error;
      if (data && data.length === 0) throw new Error("Assignment failed: No rows updated (Permission denied?)");
      return { ledgerIds, partnerId };
    },
    onSuccess: (data) => {
      toast.success(`Assigned ${data.ledgerIds.length} stops successfully!`);
      queryClient.invalidateQueries({ queryKey: ["admin-logistics-manifest-today"] });
      queryClient.invalidateQueries({ queryKey: ["tomorrow-dispatch-manifest"] });
      queryClient.invalidateQueries({ queryKey: ["admin-logistics-manifest"] });
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
      const { error } = await (supabase as any)
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
      const { error } = await (supabase as any)
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

  // --- MUTATION 4: Update Subscription Status (Tab 3: Active Subscriptions) ---
  const updateSubStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any).from("subscriptions").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subscription status updated");
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions-all"] });
      queryClient.invalidateQueries({ queryKey: ["admin-logistics-customers"] });
      queryClient.invalidateQueries({ queryKey: ["tomorrow-dispatch-manifest", tomorrowStr] });
    },
  });

  // --- MUTATION 5: Create Plan ---
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
      queryClient.invalidateQueries({ queryKey: ["admin-subscription-plans"] });
    },
    onError: (err: any) => {
      toast.error("Failed to create plan: " + err.message);
    },
  });

  // --- MUTATION 6: Update Plan ---
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
      queryClient.invalidateQueries({ queryKey: ["admin-subscription-plans"] });
    },
    onError: (err: any) => {
      toast.error("Failed to update plan: " + err.message);
    },
  });

  // --- MUTATION 7: Delete Plan ---
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
      queryClient.invalidateQueries({ queryKey: ["admin-subscription-plans"] });
    },
    onError: (err: any) => {
      toast.error("Failed to delete plan: " + err.message);
    },
  });

  // --- MUTATION 8: Toggle Plan Active ---
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
      queryClient.invalidateQueries({ queryKey: ["admin-subscription-plans"] });
    },
    onError: (err: any) => {
      toast.error("Failed to update status: " + err.message);
    },
  });

  // --- CLUSTERING REDUCER (Pincode -> Area/Colony -> Stop) ---
  const activeDeliveries = useMemo(() => {
    return adminManifestTab === 'today' ? todayDispatchQ.data || [] : tomorrowDispatchQ.data || [];
  }, [adminManifestTab, todayDispatchQ.data, tomorrowDispatchQ.data]);
  
  const geographicalClusters = useMemo(() => {
    const groups: Record<string, Record<string, DeliveryStop[]>> = {};
    const stopMap = new Map<string, DeliveryStop>();

    activeDeliveries.forEach((masterOrder: any) => {
      // Find an address from any of the ledger items
      let addr: any = {};
      masterOrder.delivery_ledger?.forEach((ledgerItem: any) => {
        if (ledgerItem.subscriptions?.addresses) {
          addr = ledgerItem.subscriptions.addresses;
        }
      });
      
      const profile = masterOrder.profiles || {};
      const pincode = addr.pincode || "Unknown Pincode";
      const area = addr.landmark || addr.city || "Unknown Area";
      
      const userId = masterOrder.user_id || "guest";
      const stopId = masterOrder.id; // The master box ID is exactly the stop ID

      const newStop: DeliveryStop = {
        id: stopId,
        userId,
        customerInfo: profile,
        address: addr,
        assignedDriverId: masterOrder.delivery_partner_id,
        items: [],
        netQuantity: 0,
        custom_order_id: masterOrder.custom_order_id
      };

      masterOrder.delivery_ledger?.forEach((d: any) => {
        const qty = d.quantity ?? d.subscriptions?.quantity ?? 1;
        newStop.items.push({
          ledgerId: d.id,
          productSlug: d.product_slug || d.subscriptions?.product_slug,
          quantity: qty,
          price: d.effective_price || 0,
          status: d.status || 'scheduled',
          custom_order_id: masterOrder.custom_order_id
        });
        newStop.netQuantity += qty;
      });

      if (!groups[pincode]) groups[pincode] = {};
      if (!groups[pincode][area]) groups[pincode][area] = [];
      groups[pincode][area].push(newStop);
    });

    return groups;
  }, [activeDeliveries]);

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
  const handleToggleRow = (stop: DeliveryStop) => {
    const stopLedgerIds = stop.items.map(i => i.ledgerId);
    const isSelected = stopLedgerIds.every(id => selectedLedgerIds.includes(id));
    
    if (isSelected) {
      setSelectedLedgerIds(prev => prev.filter(id => !stopLedgerIds.includes(id)));
    } else {
      setSelectedLedgerIds(prev => {
        const unique = new Set([...prev, ...stopLedgerIds]);
        return Array.from(unique);
      });
    }
  };

  const handleToggleCluster = (clusterStops: DeliveryStop[]) => {
    const clusterLedgerIds = clusterStops.flatMap(s => s.items.map(i => i.ledgerId));
    const allSelected = clusterLedgerIds.every(id => selectedLedgerIds.includes(id));

    if (allSelected) {
      setSelectedLedgerIds(prev => prev.filter(id => !clusterLedgerIds.includes(id)));
    } else {
      setSelectedLedgerIds(prev => {
        const unique = new Set([...prev, ...clusterLedgerIds]);
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
          <span className="text-xs font-bold text-brown">
            Manifest Date: {adminManifestTab === 'today' ? `${todayStr} (Today)` : `${tomorrowStr} (Tomorrow)`}
          </span>
        </div>
      </div>

      {/* DASHBOARD TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-secondary/40 p-1 mb-6">
          <TabsTrigger value="tomorrow-dispatch" className="flex items-center gap-2">
            <Navigation className="w-4 h-4" /> Route Stops Dispatch Board
          </TabsTrigger>
          <TabsTrigger value="driver-registry" className="flex items-center gap-2">
            <Truck className="w-4 h-4" /> Active Driver Shifts
          </TabsTrigger>
          <TabsTrigger value="active-subscriptions" className="flex items-center gap-2">
            <Repeat className="w-4 h-4" /> Active Subscriptions
          </TabsTrigger>
          <TabsTrigger value="manage-plans" className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Manage Plans
          </TabsTrigger>
          <TabsTrigger value="wallet-overrides" className="flex items-center gap-2">
            <Sliders className="w-4 h-4" /> Customer Ledger Overrides
          </TabsTrigger>
        </TabsList>

        {/* 1. DISPATCH BOARD CLUSTERING VIEW (TODAY & TOMORROW) */}
        <TabsContent value="tomorrow-dispatch" className="space-y-6">
          {/* Main View Segmented Toggles */}
          <div className="flex gap-2 bg-secondary/30 border border-border p-1 rounded-2xl max-w-md">
            <button
              onClick={() => {
                setAdminManifestTab('today');
                setSelectedLedgerIds([]); // Reset selection on switch
              }}
              className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                adminManifestTab === 'today' ? 'bg-brown text-primary shadow-md' : 'text-muted-foreground hover:text-brown'
              }`}
            >
              🚚 Today's Live Orders ({todayDispatchQ.data?.length || 0})
            </button>
            <button
              onClick={() => {
                setAdminManifestTab('tomorrow');
                setSelectedLedgerIds([]); // Reset selection on switch
              }}
              className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                adminManifestTab === 'tomorrow' ? 'bg-brown text-primary shadow-md' : 'text-muted-foreground hover:text-brown'
              }`}
            >
              ⏳ Tomorrow's Route Staging ({tomorrowDispatchQ.data?.length || 0})
            </button>
          </div>

          {(adminManifestTab === 'today' ? todayDispatchQ.isLoading : tomorrowDispatchQ.isLoading) ? (
            <div className="space-y-4">
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
            </div>
          ) : (adminManifestTab === 'today' ? todayDispatchQ.error : tomorrowDispatchQ.error) ? (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-2xl text-sm">
              Error loading dispatch entries: {((adminManifestTab === 'today' ? todayDispatchQ.error : tomorrowDispatchQ.error) as any).message}
            </div>
          ) : activeDeliveries.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border flex flex-col items-center animate-in fade-in duration-300">
              <CheckCircle2 className="w-12 h-12 text-muted-foreground mb-3 opacity-30" />
              <p className="font-display font-bold text-brown">
                {adminManifestTab === 'today' ? "No active deliveries today" : "No scheduled deliveries for tomorrow"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {adminManifestTab === 'today' ? `There are no recurring subscription ledger rows scheduled for ${todayStr}.` : `There are no upcoming scheduled subscription ledger rows for ${tomorrowStr}.`}
              </p>
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
                                  {deliveries.map((stop: DeliveryStop) => {
                                    const profile = stop.customerInfo;
                                    const addr = stop.address;
                                    const isAssigned = !!stop.assignedDriverId;
                                    const isAllSelected = stop.items.every(item => selectedLedgerIds.includes(item.ledgerId));

                                    return (
                                      <tr
                                        key={stop.id}
                                        className={`hover:bg-secondary/10 transition-colors ${
                                          isAllSelected
                                            ? "bg-primary/5"
                                            : isAssigned
                                            ? "bg-green-50/20"
                                            : "bg-red-50/10"
                                        }`}
                                      >
                                        <td className="px-4 py-3 text-center align-top w-12">
                                          <Checkbox
                                            checked={isAllSelected}
                                            onCheckedChange={() => handleToggleRow(stop)}
                                            className="mt-1"
                                          />
                                        </td>
                                        <td className="px-4 py-3 align-top max-w-[200px]">
                                          <div className="font-bold text-brown truncate">{profile.full_name || 'Guest User'}</div>
                                          <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5">
                                              TOTAL: {stop.netQuantity}
                                            </span>
                                          </div>
                                          <div className="text-[10px] text-muted-foreground mt-0.5 break-all">{profile.phone || profile.email || '—'}</div>
                                        </td>
                                        <td className="px-4 py-3 align-top min-w-[280px]">
                                          <div className="bg-stone-900 text-amber-400 font-mono text-xl font-black px-4 py-2 rounded-lg tracking-widest border border-stone-800 shadow-md flex items-center gap-2 mb-3 w-max">
                                            📦 BOX ID: <span className="text-white font-mono">{stop.custom_order_id}</span>
                                          </div>
                                          <div className="space-y-2">
                                            {stop.items.map((item, idx) => {
                                              const isCanceledOrFailed = item.status === 'failed' || item.status === 'skipped' || item.status === 'out_of_stock';
                                              return (
                                                <div key={idx} className="flex flex-col">
                                                  <div className="flex items-center gap-1.5 font-medium text-brown flex-wrap">
                                                    <Package className="w-3.5 h-3.5 text-primary shrink-0" />
                                                    <span className={`text-sm ${isCanceledOrFailed ? 'line-through text-muted-foreground/60' : ''}`}>
                                                    {item.quantity}x {item.productSlug} <span className="text-[10px] text-muted-foreground">(₹{item.price})</span>
                                                  </span>
                                                  {adminManifestTab === 'today' && (
                                                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase border shrink-0 ${
                                                      item.status === 'delivered' ? 'bg-green-50 text-green-700 border-green-200' :
                                                      item.status === 'out_for_delivery' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                      item.status === 'skipped' ? 'bg-stone-50 text-stone-600 border-stone-200' :
                                                      item.status === 'failed' || item.status === 'out_of_stock' ? 'bg-red-50 text-red-700 border-red-200' :
                                                      'bg-amber-50 text-amber-700 border-amber-200'
                                                    }`}>
                                                      {item.status.replace(/_/g, " ")}
                                                    </span>
                                                  )}
                                                  {(item.status === 'pending' || item.status === 'confirmed') && (
                                                    <button
                                                      onClick={() => updateItemStatusMutation.mutate({ ledgerId: item.ledgerId, newStatus: 'out_of_stock' })}
                                                      disabled={updateItemStatusMutation.isPending}
                                                      className="text-[10px] text-red-600 hover:text-red-800 font-bold ml-1.5 hover:underline shrink-0 flex items-center gap-0.5"
                                                      title="Mark Out of Stock"
                                                    >
                                                      ❌ Mark Out of Stock
                                                    </button>
                                                  )}
                                                  {item.status === 'out_of_stock' && (
                                                    <button
                                                      onClick={() => updateItemStatusMutation.mutate({ ledgerId: item.ledgerId, newStatus: 'pending' })}
                                                      disabled={updateItemStatusMutation.isPending}
                                                      className="text-[10px] text-emerald-700 hover:text-emerald-900 font-bold ml-1.5 hover:underline shrink-0 flex items-center gap-0.5 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded"
                                                      title="Restore to Pending — stock is available again"
                                                    >
                                                      🔄 Restore Stock
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                          <div className="font-medium text-brown capitalize">
                                            {addr.address_line_1 || "—"}
                                          </div>
                                          {addr.address_line_2 && (
                                            <div className="text-[10px] text-muted-foreground capitalize">
                                              {addr.address_line_2}
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                          {isAssigned ? (
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
                                              🚚 {partnersQ.data?.find((p: any) => p.user_id === stop.assignedDriverId)?.full_name || 'delivery partner'}
                                            </div>
                                          ) : (
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 shadow-sm">
                                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                              ⚠️ Unassigned
                                            </div>
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
                // Calculate assigned stops count for active shift
                const assignedStops = activeDeliveries.filter((d: any) => d.delivery_partner_id === partner.user_id);
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
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                          {adminManifestTab === 'today' ? "Today's Drops" : "Tomorrow's Drops"}
                        </span>
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

        {/* 3. ACTIVE SUBSCRIPTIONS */}
        <TabsContent value="active-subscriptions" className="space-y-4">
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
                        <div className="flex items-center gap-1.5 font-medium text-brown">
                          <Package className="w-3.5 h-3.5 text-primary" />
                          {s.quantity}x {products.find((p: any) => p.slug === s.product_slug || p.id === s.product_id)?.name || s.product_slug}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-1">
                          {DAYS.map((day, idx) => (
                            <span 
                              key={day} 
                              className={`text-[9px] font-bold w-6 h-6 rounded-full flex items-center justify-center border ${
                                s.selected_days?.includes(idx) 
                                  ? "bg-primary/20 border-primary text-brown" 
                                  : "bg-secondary/40 border-border text-muted-foreground"
                              }`}
                            >
                              {day[0]}
                            </span>
                          ))}
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

        {/* 4. MANAGE PLANS */}
        <TabsContent value="manage-plans" className="space-y-6 pt-2">
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

        {/* 5. CUSTOMER LEDGER ADJUSTMENTS & CONTRACT OVERRIDES */}
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
                  {partnersQ.data?.filter((p: any) => p.user_id).map((p: any) => (
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
