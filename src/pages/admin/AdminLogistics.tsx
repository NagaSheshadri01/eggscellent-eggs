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
import { PackageX, RefreshCcw, HandCoins, ArrowRight, UserCog, Car, Copy } from "lucide-react";
import { handleSubscriptionPause, handleSubscriptionResume } from "@/lib/subscriptionUtils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DeliveryStop {
  userId: string;
  customerInfo: any;
  address: any;
  assignedDriverId: string | null;
  items: Array<{
    id: string;
    product_slug: string;
    quantity: number;
    price: number;
    status: string;
    sourceType: 'subscription' | 'one_time';
  }>;
  netQuantity: number;
  deliveryIds: string[];
  oneTimeIds: string[];
}

export const AdminLogistics = () => {
  const queryClient = useQueryClient();

  const updateItemStatusMutation = useMutation({
    mutationFn: async ({ itemId, sourceType, newStatus }: { itemId: string; sourceType: 'subscription' | 'one_time'; newStatus: string }) => {
      const table = sourceType === 'subscription' ? 'subscription_delivery_items' : 'one_time_order_items';
      const { error } = await (supabase as any)
        .from(table)
        .update({ status: newStatus })
        .eq('id', itemId);
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
  const [selectedStopIds, setSelectedStopIds] = useState<string[]>([]);
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

  const todayDispatchQ = useQuery({
    queryKey: ["admin-logistics-manifest-today", todayStr],
    queryFn: async () => {
      const targetDate = todayStr;
      
      let subDeliveries = [];
      try {
        const { data: subData, error: subErr } = await (supabase as any)
          .from("subscription_deliveries")
          .select(`
            *,
            profiles:user_id (id, full_name, phone, email),
            subscription_delivery_items (*),
            addresses:delivery_address_id (*)
          `)
          .eq("delivery_date", targetDate);
        if (subErr) throw subErr;
        subDeliveries = subData || [];
      } catch (err: any) {
        console.error("Subscription Pipeline Error:", err);
        toast.error("Failed to fetch subscription items: " + err.message);
      }

      let retailDeliveries = [];
      try {
        const { data: retailData, error: retailErr } = await (supabase as any)
          .from("one_time_orders")
          .select(`
            *,
            profiles:user_id (id, full_name, phone, email),
            one_time_order_items (*),
            addresses:delivery_address_id (*)
          `)
          .eq("delivery_date", targetDate);
        if (retailErr) throw retailErr;
        retailDeliveries = retailData || [];
      } catch (err: any) {
        console.error("Retail Pipeline Error:", err);
        toast.error("Failed to fetch retail items: " + err.message);
      }

      const mergedMap = new Map();
      const processAddress = (o: any) => o.addresses || { city: '', address_line_1: '', pincode: o.pincode || '' };

      (subDeliveries || []).forEach((d: any) => {
        const mappedItems = (d.subscription_delivery_items || []).map((item: any) => ({
          id: item.id,
          product_slug: item.product_slug,
          quantity: item.quantity,
          price: item.effective_price,
          status: item.status || 'pending',
          sourceType: 'subscription'
        }));
        mergedMap.set(d.user_id, {
          userId: d.user_id,
          customerInfo: d.profiles,
          address: processAddress(d),
          assignedDriverId: d.delivery_partner_id,
          items: mappedItems,
          netQuantity: mappedItems.reduce((acc: number, i: any) => acc + i.quantity, 0),
          deliveryIds: [d.id],
          oneTimeIds: []
        });
      });

      (retailDeliveries || []).forEach((o: any) => {
        const mappedItems = (o.one_time_order_items || []).map((item: any) => ({
          id: item.id,
          product_slug: item.product_slug,
          quantity: item.quantity,
          price: item.price,
          status: item.status || 'pending',
          sourceType: 'one_time'
        }));
        if (mergedMap.has(o.user_id)) {
           const existing = mergedMap.get(o.user_id);
           existing.items.push(...mappedItems);
           existing.netQuantity += mappedItems.reduce((acc: number, i: any) => acc + i.quantity, 0);
           existing.oneTimeIds.push(o.id);
        } else {
           mergedMap.set(o.user_id, {
             userId: o.user_id,
             customerInfo: o.profiles,
             address: processAddress(o),
             assignedDriverId: o.delivery_partner_id,
             items: mappedItems,
             netQuantity: mappedItems.reduce((acc: number, i: any) => acc + i.quantity, 0),
             deliveryIds: [],
             oneTimeIds: [o.id]
           });
        }
      });
      return Array.from(mergedMap.values()) as DeliveryStop[];
    }
  });

  const tomorrowDispatchQ = useQuery({
    queryKey: ["tomorrow-dispatch-manifest", tomorrowStr],
    queryFn: async () => {
      const targetDate = tomorrowStr;
      
      let subDeliveries = [];
      try {
        const { data: subData, error: subErr } = await (supabase as any)
          .from("subscription_deliveries")
          .select(`
            *,
            profiles:user_id (id, full_name, phone, email),
            subscription_delivery_items (*),
            addresses:delivery_address_id (*)
          `)
          .eq("delivery_date", targetDate);
        if (subErr) throw subErr;
        subDeliveries = subData || [];
      } catch (err: any) {
        console.error("Subscription Pipeline Error (Tomorrow):", err);
        toast.error("Failed to fetch subscription items: " + err.message);
      }

      let retailDeliveries = [];
      try {
        const { data: retailData, error: retailErr } = await (supabase as any)
          .from("one_time_orders")
          .select(`
            *,
            profiles:user_id (id, full_name, phone, email),
            one_time_order_items (*),
            addresses:delivery_address_id (*)
          `)
          .eq("delivery_date", targetDate);
        if (retailErr) throw retailErr;
        retailDeliveries = retailData || [];
      } catch (err: any) {
        console.error("Retail Pipeline Error (Tomorrow):", err);
        toast.error("Failed to fetch retail items: " + err.message);
      }

      const mergedMap = new Map();
      const processAddress = (o: any) => o.addresses || { city: '', address_line_1: '', pincode: o.pincode || '' };

      (subDeliveries || []).forEach((d: any) => {
        const mappedItems = (d.subscription_delivery_items || []).map((item: any) => ({
          id: item.id,
          product_slug: item.product_slug,
          quantity: item.quantity,
          price: item.effective_price,
          status: item.status || 'pending',
          sourceType: 'subscription'
        }));
        mergedMap.set(d.user_id, {
          userId: d.user_id,
          customerInfo: d.profiles,
          address: processAddress(d),
          assignedDriverId: d.delivery_partner_id,
          items: mappedItems,
          netQuantity: mappedItems.reduce((acc: number, i: any) => acc + i.quantity, 0),
          deliveryIds: [d.id],
          oneTimeIds: []
        });
      });

      (retailDeliveries || []).forEach((o: any) => {
        const mappedItems = (o.one_time_order_items || []).map((item: any) => ({
          id: item.id,
          product_slug: item.product_slug,
          quantity: item.quantity,
          price: item.price,
          status: item.status || 'pending',
          sourceType: 'one_time'
        }));
        if (mergedMap.has(o.user_id)) {
           const existing = mergedMap.get(o.user_id);
           existing.items.push(...mappedItems);
           existing.netQuantity += mappedItems.reduce((acc: number, i: any) => acc + i.quantity, 0);
           existing.oneTimeIds.push(o.id);
        } else {
           mergedMap.set(o.user_id, {
             userId: o.user_id,
             customerInfo: o.profiles,
             address: processAddress(o),
             assignedDriverId: o.delivery_partner_id,
             items: mappedItems,
             netQuantity: mappedItems.reduce((acc: number, i: any) => acc + i.quantity, 0),
             deliveryIds: [],
             oneTimeIds: [o.id]
           });
        }
      });
      return Array.from(mergedMap.values()) as DeliveryStop[];
    }
  });

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

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ stopKeys, partnerId }: { stopKeys: DeliveryStop[]; partnerId: string }) => {
      const selectedDriverId = partnerId === "unassigned" ? null : partnerId;
      
      const subDelivIds = stopKeys.flatMap(sk => sk.deliveryIds);
      const retailIds = stopKeys.flatMap(sk => sk.oneTimeIds);

      if (subDelivIds.length > 0) {
        const { error } = await (supabase as any)
          .from('subscription_deliveries')
          .update({ delivery_partner_id: selectedDriverId })
          .in('id', subDelivIds);
        if (error) throw error;
      }
      
      if (retailIds.length > 0) {
        const { error } = await (supabase as any)
          .from('one_time_orders')
          .update({ delivery_partner_id: selectedDriverId })
          .in('id', retailIds);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`Bulk assignment processed successfully!`);
      queryClient.invalidateQueries({ queryKey: ["admin-logistics-manifest-today"] });
      queryClient.invalidateQueries({ queryKey: ["tomorrow-dispatch-manifest"] });
      setSelectedStopIds([]);
      setTargetPartnerId("");
    },
    onError: (err: any) => {
      toast.error("Bulk assignment failed: " + err.message);
    }
  });

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

  const toggleSubStatusMutation = useMutation({
    mutationFn: async ({ subId, newStatus }: { subId: string; newStatus: "active" | "paused" }) => {
      if (newStatus === "paused") {
        await handleSubscriptionPause(supabase, subId);
      } else {
        await handleSubscriptionResume(supabase, subId);
      }
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
    },
    onSuccess: () => {
      toast.success("Subscription plan updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["admin-subscription-plans"] });
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
    },
    onSuccess: () => {
      toast.success("Subscription plan deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-subscription-plans"] });
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
      queryClient.invalidateQueries({ queryKey: ["admin-subscription-plans"] });
    },
    onError: (err: any) => {
      toast.error("Failed to update status: " + err.message);
    },
  });

  const activeDeliveries = useMemo(() => {
    return adminManifestTab === 'today' ? todayDispatchQ.data || [] : tomorrowDispatchQ.data || [];
  }, [adminManifestTab, todayDispatchQ.data, tomorrowDispatchQ.data]);
  
  const geographicalClusters = useMemo(() => {
    const groups: Record<string, Record<string, DeliveryStop[]>> = {};
    activeDeliveries.forEach((d: DeliveryStop) => {
      const pincode = d.address?.pincode || "Unknown Pincode";
      const area = d.address?.landmark || d.address?.city || "Unknown Area";
      if (!groups[pincode]) groups[pincode] = {};
      if (!groups[pincode][area]) groups[pincode][area] = [];
      groups[pincode][area].push(d);
    });
    return groups;
  }, [activeDeliveries]);

  const selectedCustomerInfo = useMemo(() => {
    if (!selectedCustomerId || !customersQ.data) return null;
    return customersQ.data.find((c: any) => c.id === selectedCustomerId);
  }, [selectedCustomerId, customersQ.data]);

  const filteredCustomers = useMemo(() => {
    const list = customersQ.data || [];
    if (!customerSearchQuery.trim()) return list.slice(0, 5);
    return list.filter((c: any) =>
      c.full_name?.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
      c.phone?.includes(customerSearchQuery) ||
      c.email?.toLowerCase().includes(customerSearchQuery.toLowerCase())
    );
  }, [customerSearchQuery, customersQ.data]);

  const handleToggleRow = (stop: DeliveryStop) => {
    const isSelected = selectedStopIds.includes(stop.userId);
    if (isSelected) {
      setSelectedStopIds(prev => prev.filter(id => id !== stop.userId));
    } else {
      setSelectedStopIds(prev => [...prev, stop.userId]);
    }
  };

  const handleToggleCluster = (clusterStops: DeliveryStop[]) => {
    const clusterUserIds = clusterStops.map(s => s.userId);
    const allSelected = clusterUserIds.every(id => selectedStopIds.includes(id));
    if (allSelected) {
      setSelectedStopIds(prev => prev.filter(id => !clusterUserIds.includes(id)));
    } else {
      setSelectedStopIds(prev => Array.from(new Set([...prev, ...clusterUserIds])));
    }
  };

  return (
    <div className="space-y-6 pb-28">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-brown text-3xl tracking-tight">Administrative Logistics Board</h1>
          <p className="text-sm text-muted-foreground mt-1">Supervise manifests, match routes, and manage customer ledgers.</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-2xl border border-border/80 flex items-center gap-2 self-start">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-brown">
            Manifest Date: {adminManifestTab === 'today' ? `${todayStr} (Today)` : `${tomorrowStr} (Tomorrow)`}
          </span>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-secondary/40 p-1 mb-6">
          <TabsTrigger value="tomorrow-dispatch" className="flex items-center gap-2">
            <Navigation className="w-4 h-4" /> Dispatch Board
          </TabsTrigger>
          <TabsTrigger value="driver-registry" className="flex items-center gap-2">
            <Truck className="w-4 h-4" /> Drivers
          </TabsTrigger>
          <TabsTrigger value="active-subscriptions" className="flex items-center gap-2">
            <Repeat className="w-4 h-4" /> Subscriptions
          </TabsTrigger>
          <TabsTrigger value="manage-plans" className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Plans
          </TabsTrigger>
          <TabsTrigger value="wallet-overrides" className="flex items-center gap-2">
            <Sliders className="w-4 h-4" /> Overrides
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tomorrow-dispatch" className="space-y-6">
          <div className="flex gap-2 bg-secondary/30 border border-border p-1 rounded-2xl max-w-md">
            <button
              onClick={() => { setAdminManifestTab('today'); setSelectedStopIds([]); }}
              className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs transition-all ${adminManifestTab === 'today' ? 'bg-brown text-primary' : 'text-muted-foreground'}`}
            >
              🚚 Today
            </button>
            <button
              onClick={() => { setAdminManifestTab('tomorrow'); setSelectedStopIds([]); }}
              className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs transition-all ${adminManifestTab === 'tomorrow' ? 'bg-brown text-primary' : 'text-muted-foreground'}`}
            >
              ⏳ Tomorrow
            </button>
          </div>

          {Object.keys(geographicalClusters).length === 0 ? (
            <div className="bg-card border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-secondary/30 rounded-full flex items-center justify-center mb-4">
                <Truck className="w-8 h-8 text-primary/50" />
              </div>
              <h3 className="font-display font-bold text-brown text-xl">No Deliveries Dispatched for This Date</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                There are currently zero active subscription deliveries or one-time retail orders scheduled for this dispatch window.
              </p>
            </div>
          ) : (
            Object.entries(geographicalClusters).map(([pincode, areas]) => (
              <div key={pincode} className="space-y-3">
                <span className="font-display font-bold text-brown text-lg">📮 Pincode: {pincode}</span>
                <Accordion type="multiple" defaultValue={Object.keys(areas)} className="space-y-3">
                  {Object.entries(areas).map(([area, deliveries]) => {
                    const clusterIds = deliveries.map((d) => d.userId);
                    const isAllSelected = clusterIds.every(id => selectedStopIds.includes(id));
                    return (
                      <AccordionItem key={area} value={area} className="bg-card border rounded-2xl px-4 py-2">
                        <div className="flex items-center gap-4">
                          <Checkbox checked={isAllSelected} onCheckedChange={() => handleToggleCluster(deliveries)} />
                          <AccordionTrigger className="flex-1">{area}</AccordionTrigger>
                        </div>
                        <AccordionContent>
                          {deliveries.map((stop: DeliveryStop) => (
                            <div key={stop.userId} className="p-4 border-b flex items-start gap-4">
                              <Checkbox checked={selectedStopIds.includes(stop.userId)} onCheckedChange={() => handleToggleRow(stop)} />
                              <div className="flex-1 space-y-2">
                                <p className="font-bold">{stop.customerInfo?.full_name}</p>
                                {stop.items.map((item, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-sm p-3 bg-secondary/10 rounded-xl">
                                    <div className="flex flex-col gap-1">
                                      <span className="font-bold">{item.quantity}x {item.product_slug}</span>
                                      {item.sourceType === 'one_time' ? (
                                        <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full inline-block w-fit flex items-center gap-1"><Package className="w-3 h-3" /> One-Time</span>
                                      ) : (
                                        <span className="text-[10px] uppercase font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full inline-block w-fit flex items-center gap-1"><Repeat className="w-3 h-3" /> Subscription</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {item.status === 'out_of_stock' ? (
                                        <Button variant="outline" size="sm" onClick={() => updateItemStatusMutation.mutate({ itemId: item.id, sourceType: item.sourceType, newStatus: 'pending' })}><RefreshCcw className="w-3 h-3 mr-1" /> Restore</Button>
                                      ) : (
                                        <Button variant="outline" size="sm" className="text-destructive" onClick={() => updateItemStatusMutation.mutate({ itemId: item.id, sourceType: item.sourceType, newStatus: 'out_of_stock' })}><PackageX className="w-3 h-3 mr-1" /> Out of Stock</Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="driver-registry" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(partnersQ.data || []).map((p: any) => (
            <div key={p.user_id} className="bg-card p-4 rounded-2xl border flex items-center justify-between">
              <div>
                <h3 className="font-bold">{p.full_name}</h3>
                <p className="text-xs text-muted-foreground">{p.active ? "Active" : "Offline"}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">{activeDeliveries.filter((d: any) => d.assignedDriverId === p.user_id).length} Stops</p>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="active-subscriptions">
            {/* Implementation for Subscription List ... */}
        </TabsContent>

        <TabsContent value="manage-plans">
            {/* Implementation for Plan Creator ... */}
        </TabsContent>

        <TabsContent value="wallet-overrides">
            {/* Implementation for Wallet Overrides ... */}
        </TabsContent>
      </Tabs>

      {selectedStopIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-brown text-primary-foreground p-4 rounded-2xl shadow-2xl flex items-center gap-4 z-50">
          <span className="font-bold text-sm">{selectedStopIds.length} Stops Selected</span>
          <div className="flex gap-2">
            <Select value={targetPartnerId} onValueChange={setTargetPartnerId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select Driver..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Remove Assignment</SelectItem>
                {partnersQ.data?.map((p: any) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant="default"
              disabled={!targetPartnerId || selectedStopIds.length === 0 || bulkAssignMutation.isPending}
              onClick={() => {
                const activeManifest = adminManifestTab === 'today' ? todayDispatchQ.data : tomorrowDispatchQ.data;
                bulkAssignMutation.mutate({ 
                  stopKeys: (activeManifest || []).filter(s => selectedStopIds.includes(s.userId)), 
                  partnerId: targetPartnerId 
                })
              }}
            >
              {bulkAssignMutation.isPending ? "Assigning..." : "Assign Selected"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLogistics;
