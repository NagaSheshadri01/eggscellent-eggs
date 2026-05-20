import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Navigation, Package, Phone, ShieldCheck, LogOut, Clock, Check, Repeat, Zap } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { usePartnerStatus } from "@/hooks/usePartnerStatus";
import { Badge } from "@/components/ui/badge";
import Seo from "@/components/Seo";
import { format } from "date-fns";

import { getSlotLabel } from "@/constants/delivery";
import { PartnerOrderCard as SwipePartnerOrderCard } from "@/components/partner/PartnerOrderCard";
import { DeliveryIssueModal } from "@/components/partner/DeliveryIssueModal";
import { useDriverShift } from "@/hooks/useDriverShift";
import { useProducts } from "@/hooks/useProducts";

const WAREHOUSE_DEFAULT = { lat: 17.5012, lng: 78.4985 };

type AddrSnap = {
  full_name?: string; phone?: string; address_line_1?: string; address_line_2?: string;
  city?: string; state?: string; pincode?: string; landmark?: string; house_no?: string;
};

const STATUS_FLOW: Record<string, { next: string; label: string }> = {
  placed:           { next: "confirmed",        label: "Mark confirmed" },
  confirmed:        { next: "out_for_delivery", label: "Out for delivery" },
  out_for_delivery: { next: "delivered",        label: "Mark delivered" },
};

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

const PartnerOrderCard = ({ order, onUpdate, compact }: { order: any; onUpdate: () => void; compact?: boolean }) => {
  const snap: AddrSnap = order.address_snapshot || {};
  const dbAddr = order.addresses || {};
  
  const flow = STATUS_FLOW[order.order_status];

  const advance = async () => {
    if (!flow) return;
    const { error } = await supabase.rpc("partner_update_order_status", {
      _order_id: order.id, _new_status: flow.next,
    });
    if (error) toast.error(error.message);
    else { toast.success(flow.label.replace("Mark ", "")); onUpdate(); }
  };

  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        {flow && (
          <Button variant="hero" size="sm" className="h-9 px-4 font-bold shadow-sm" onClick={advance}>
            {flow.label}
          </Button>
        )}
      </div>
    );
  }

  // Building-First Priority Logic
  const houseNo = dbAddr.house_no || "";
  const building = dbAddr.building_name || snap.address_line_1 || "Unknown Building";
  const landmark = dbAddr.landmark || snap.landmark || "No Landmark";
  const pincode = dbAddr.pincode || snap.pincode || "";

  // Force Coordinate-Based Navigation (Driving Mode)
  const navUrl = dbAddr.lat && dbAddr.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${dbAddr.lat},${dbAddr.lng}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${houseNo}+${building}+${pincode}`)}`;

  return (
    <div className="bg-card rounded-2xl shadow-soft p-5 space-y-4 border border-border/50">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1">#{order.id.slice(0, 8)}</div>
          <div className="font-display font-bold text-brown text-lg leading-tight">{snap.full_name || "Customer"}</div>
        </div>
        <Badge className="bg-primary/10 text-brown border-none text-[10px] uppercase tracking-tighter shrink-0">
          {order.order_status.replace(/_/g, " ")}
        </Badge>
      </div>

      <div className="space-y-1.5 py-3 border-y border-border/30">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <div className="flex flex-col">
            {(() => {
              const address = {
                house_no: dbAddr.house_no || snap.house_no || "",
                house_name: dbAddr.building_name || dbAddr.house_name || snap.address_line_1 || "Building",
                landmark: dbAddr.landmark || snap.landmark || "",
                city: dbAddr.city || snap.city || "Bangalore",
                state: dbAddr.state || snap.state || "Karnataka",
                pincode: dbAddr.pincode || snap.pincode || ""
              };
              return (
                <div className="text-sm font-medium text-slate-700 mt-1">
                  📍 {address.house_no}, {address.house_name}
                  {address.landmark ? `, Near ${address.landmark}` : ''}
                  <br />
                  {address.city}, {address.state} - {address.pincode}
                </div>
              );
            })()}
          </div>
        </div>
      </div>


      <div className="flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Package className="w-3.5 h-3.5" /> 
          <span className="font-semibold">{(order as any).delivery_slots?.tag || order.delivery_slot || "Early Morning"}</span>
        </div>
        <div className="font-bold text-brown text-base">₹{order.total}</div>
      </div>

      <div className="grid grid-cols-5 gap-2 pt-1">
        <a href={navUrl} target="_blank" rel="noopener noreferrer" className="col-span-4">
          <Button variant="brown" className="w-full h-11 shadow-lg shadow-brown/10 font-bold" type="button">
            <Navigation className="w-4 h-4 mr-2" /> Start Navigation
          </Button>
        </a>
        {snap.phone && (
          <a href={`tel:${snap.phone}`} className="col-span-1">
            <Button variant="outline" className="w-full h-11 border-border/50" type="button">
              <Phone className="w-4 h-4" />
            </Button>
          </a>
        )}
      </div>

      {flow && (
        <Button variant="hero" className="w-full h-11 mt-1 shadow-lg shadow-primary/20" onClick={advance}>
          {flow.label}
        </Button>
      )}
    </div>
  );
};

const Partner = () => {
  const { user, signOut, loading, roleLoading, isAdmin, isPartner } = useAuth();
  const { data: status, isLoading: statusLoading } = usePartnerStatus();
  const qc = useQueryClient();

  const partnerId = status?.partner?.id;
  const [activeFeed, setActiveFeed] = useState<'instant' | 'subscription'>('instant');
  const [loc, setLoc] = useState<{lat: number, lng: number} | null>(null);
  const [warehouse, setWarehouse] = useState(WAREHOUSE_DEFAULT);

  // Phase 5: Driver Shift states and hooks
  const [completedStops, setCompletedStops] = useState<Record<string, boolean>>({});
  const [selectedIssueStopId, setSelectedIssueStopId] = useState<string | null>(null);
  
  const { data: productsList = [] } = useProducts({ onlyActive: false });

  useEffect(() => {
    const fetchWarehouse = async () => {
      const { data } = await (supabase.from("app_settings") as any).select("value").eq("key", "warehouse_config").maybeSingle();
      if (data?.value) {
        try {
          const config = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
          if (config.lat && config.lng) setWarehouse(config);
        } catch (e) { console.error("Invalid warehouse config", e); }
      }
    };
    fetchWarehouse();
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => console.warn("Location permission denied.")
      );
    }
  }, []);

  const orders = useQuery({
    queryKey: ["partner_orders", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          addresses(*),
          delivery_slots(*)
        ` as any)
        .eq("delivery_partner_id", user!.id)
        .in("order_status", ["confirmed", "out_for_delivery"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { updateStopStatus } = useDriverShift(user?.id, todayStr);
  const subDeliveries = useQuery({
    queryKey: ["partner_sub_deliveries", user?.id, todayStr],
    enabled: !!user?.id && activeFeed === 'subscription',
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("delivery_ledger")
        .select(`*, subscriptions(product_slug, quantity, address_id, addresses(full_name, lat, lng, address_line_1, pincode))`)
        .eq("delivery_partner_id", user!.id)
        .in("status", ["scheduled", "out_for_delivery"])
        .eq("delivery_date", todayStr);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`partner_orders_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `delivery_partner_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["partner_orders", user.id] }),
      )
      .on('broadcast', { event: 'direct_assignment' }, ({ payload }) => {
        if (payload.partnerId === user.id) {
          // Immediately update local cache with the data handed off by Admin
          qc.setQueryData(["partner_orders", user.id], (prev: any[] | undefined) => {
            const existingIds = new Set((prev || []).map(o => o.id));
            const newOrders = payload.orders.filter((o: any) => !existingIds.has(o.id));
            return [...newOrders, ...(prev || [])];
          });
          toast.info(`New assignment: ${payload.orders.length} order(s) received`);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, qc]);

  // ⚠️ ALL hooks MUST be before any conditional returns (Rules of Hooks)
  const groupedOrders = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const activeOrders = ((orders.data || []) as any[]).filter(o => o.order_status !== "delivered" && o.order_status !== "cancelled");
    activeOrders.forEach((o: any) => {
      const slotId = o.slot_id || "unassigned";
      if (!groups[slotId]) groups[slotId] = [];
      groups[slotId].push(o);
    });
    return groups;
  }, [orders.data]);

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-secondary/30">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground animate-pulse font-medium">Validating partner session…</p>
        </div>
      </div>
    );
  }

  if (!isPartner && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (orders.error) {
    return (
      <div className="min-h-screen grid place-items-center bg-secondary/30 px-4">
        <div className="bg-card rounded-2xl p-8 max-w-md text-center shadow-soft">
          <h2 className="font-display font-bold text-brown text-xl mb-2">Sync Error</h2>
          <p className="text-sm text-muted-foreground mb-6">Failed to load assigned orders. Please check your connection and try again.</p>
          <Button onClick={() => orders.refetch()} variant="hero">Retry Sync</Button>
        </div>
      </div>
    );
  }

  const getMultiStopUrl = (shiftOrders: any[]) => {
    const routeOrders = shiftOrders.filter(o => o.order_status !== "delivered" && o.addresses?.lat && o.addresses?.lng);
    if (routeOrders.length === 0) return null;

    const waypoints = routeOrders.map(o => `${o.addresses.lat},${o.addresses.lng}`);
    const lastStop = waypoints.pop();
    const wpString = waypoints.join("|");
    
    return `https://www.google.com/maps/dir/?api=1&origin=${warehouse.lat},${warehouse.lng}&destination=${lastStop}${wpString ? `&waypoints=${wpString}` : ""}&travelmode=driving`;
  };

  const bulkMarkOutForDelivery = async (shiftOrders: any[]) => {
    const ids = shiftOrders.filter(o => o.order_status === "confirmed").map(o => o.id);
    if (ids.length === 0) {
      toast.info("No orders to dispatch in this shift.");
      return;
    }
    
    const { error } = await supabase.from("orders").update({ order_status: "out_for_delivery" }).in("id", ids);
    if (error) {
      toast.error("Failed to dispatch: " + error.message);
    } else {
      orders.refetch();
      toast.success(`${ids.length} orders marked as out for delivery!`);
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <Seo title="Partner Portal — Eggscellent" />
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-brown transition-colors">
            <ArrowLeft className="w-4 h-4" /> Exit Portal
          </Link>
          <div className="text-sm font-medium">
            <span className="font-display font-bold text-brown">Partner Dashboard</span>
            <span className="text-muted-foreground hidden sm:inline"> · {(user?.email && !/@auth\.eggscellent\.app$/i.test(user.email)) ? user.email : user?.phone}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-brown"><LogOut className="w-4 h-4" /> Sign out</Button>
        </div>
      </header>

      <main className="container max-w-4xl py-8 px-4 space-y-8">
        {/* Feed Toggle */}
        <div className="flex gap-2 bg-card border border-border rounded-2xl p-1.5 shadow-soft">
          <button
            onClick={() => setActiveFeed('instant')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
              activeFeed === 'instant' ? 'bg-brown text-primary shadow-md' : 'text-muted-foreground hover:text-brown'
            }`}
          >
            <Zap className="w-4 h-4" /> Instant Orders
          </button>
          <button
            onClick={() => setActiveFeed('subscription')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
              activeFeed === 'subscription' ? 'bg-brown text-primary shadow-md' : 'text-muted-foreground hover:text-brown'
            }`}
          >
            <Repeat className="w-4 h-4" /> Subscription Shifts
          </button>
        </div>

        {activeFeed === 'subscription' && (() => {
          const rawStops = subDeliveries.data || [];
          const activeStops = rawStops.filter((s: any) => !completedStops[s.id] && s.status !== 'delivered' && s.status !== 'skipped' && s.status !== 'failed');

          return (
            <div className="space-y-6">
              <div>
                <h1 className="font-display font-bold text-brown text-3xl tracking-tight">Subscription Shift</h1>
                <p className="text-sm text-muted-foreground">Today's recurring delivery queue — {todayStr}</p>
              </div>

              {subDeliveries.isLoading && <div className="space-y-3"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>}
              {subDeliveries.error && <div className="bg-destructive/10 text-destructive p-4 rounded-2xl text-sm">Error: {(subDeliveries.error as any).message}</div>}

              {!subDeliveries.isLoading && activeStops.length === 0 && (
                <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border animate-in fade-in duration-300">
                  <Repeat className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
                  <p className="font-display font-bold text-brown">No active subscription deliveries today</p>
                  <p className="text-sm text-muted-foreground mt-1">All subscription stops have been successfully completed or exception-handled.</p>
                </div>
              )}

              {activeStops.length > 0 && (() => {
                const allCoords = activeStops
                  .map((s: any) => s.subscriptions?.addresses)
                  .filter((a: any) => a?.lat && a?.lng);
                const routeUrl = allCoords.length > 0
                  ? `https://www.google.com/maps/dir/?api=1&origin=${warehouse.lat},${warehouse.lng}&destination=${allCoords[allCoords.length-1].lat},${allCoords[allCoords.length-1].lng}${allCoords.length > 1 ? `&waypoints=${allCoords.slice(0,-1).map((a: any) => `${a.lat},${a.lng}`).join('|')}` : ''}&travelmode=driving`
                  : null;

                return (
                  <div className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden animate-in fade-in duration-500">
                    <div className="p-6 border-b border-border/40 bg-secondary/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                          <Repeat className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="font-display font-bold text-brown text-xl">🌅 Early Morning Subscription Shift</h2>
                          <p className="text-xs text-muted-foreground mt-0.5">{activeStops.length} recurring stops remaining</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {routeUrl && (
                          <a href={routeUrl} target="_blank" rel="noreferrer">
                            <Button variant="outline" className="border-primary text-primary hover:bg-primary/5 h-12 px-6 font-bold">
                              <Navigation className="w-4 h-4 mr-2" /> Continue Route
                            </Button>
                          </a>
                        )}
                        {activeStops.some((s: any) => s.status === 'scheduled') && (
                          <Button
                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold h-12 px-6 shadow-lg shadow-amber-500/20"
                            onClick={async () => {
                              const pendingIds = activeStops.filter((s: any) => s.status === 'scheduled').map((s: any) => s.id);
                              const { error } = await (supabase as any).from('delivery_ledger').update({ status: 'out_for_delivery' }).in('id', pendingIds);
                              if (error) toast.error(error.message);
                              else { subDeliveries.refetch(); toast.success(`${pendingIds.length} subscription stops dispatched!`); }
                            }}
                          >
                            🚚 Start Subscription Shift
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] font-bold tracking-widest mb-4">
                        <ShieldCheck className="w-4 h-4" /> Shift Manifesto & Verification
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {activeStops.map((s: any) => {
                          const matchingProduct = productsList.find((p: any) => p.slug === s.subscriptions?.product_slug);
                          const productName = matchingProduct?.name || s.subscriptions?.product_slug || "Premium Eggs";
                          const effectivePrice = matchingProduct?.discountPrice || matchingProduct?.discounted_price || 150.00;

                          return (
                            <div 
                              key={s.id}
                              className="transition-all duration-500 ease-out transform"
                            >
                              <SwipePartnerOrderCard
                                deliveryItem={s}
                                productName={productName}
                                effectivePrice={effectivePrice}
                                onConfirmDelivery={async (stopId) => {
                                  // Optimistic Collapse State setting
                                  setCompletedStops(prev => ({ ...prev, [stopId]: true }));
                                  await updateStopStatus.mutateAsync({ stopId, status: 'delivered' });
                                  toast.success("Delivery confirmed and wallet deducted successfully!");
                                }}
                                onLogIssue={(stopId) => {
                                  setSelectedIssueStopId(stopId);
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Delivery Issue Modal */}
              <DeliveryIssueModal
                open={selectedIssueStopId !== null}
                onClose={() => setSelectedIssueStopId(null)}
                onSelectIssue={async (status) => {
                  if (!selectedIssueStopId) return;
                  const stopId = selectedIssueStopId;
                  setCompletedStops(prev => ({ ...prev, [stopId]: true }));
                  await updateStopStatus.mutateAsync({ stopId, status });
                  toast.success(`Delivery logged as ${status} (No wallet charges deducted)`);
                }}
              />
            </div>
          );
        })()}

        {activeFeed === 'instant' && (
        <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-brown text-3xl tracking-tight">Active Deliveries</h1>
            <p className="text-sm text-muted-foreground">Grouped by shift. Start your route to update all orders at once.</p>
          </div>
        </div>

        {orders.isLoading && <Skeleton className="h-64 rounded-2xl" />}
        {!orders.isLoading && (orders.data ?? []).length === 0 && (
          <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border flex flex-col items-center">
            <Package className="w-12 h-12 text-muted-foreground mb-3 opacity-30" />
            <p className="font-display font-bold text-brown">No orders assigned yet</p>
            <p className="text-sm text-muted-foreground mt-1">New deliveries assigned by staff will appear here instantly.</p>
          </div>
        )}

        <div className="space-y-10">
          {(Object.entries(groupedOrders) as [string, any[]][])
            .filter(([_, shiftOrders]) => shiftOrders.length > 0)
            .map(([slotId, shiftOrders]) => {
              const slotName = slotId === "subscription" ? "🌅 Early Morning Shift" : getSlotLabel(slotId);
            const isOut = shiftOrders.some((o: any) => ["out_for_delivery", "delivered"].includes(o.order_status));

            return (
              <div key={slotId} className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-6 border-b border-border/40 bg-secondary/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="font-display font-bold text-brown text-xl leading-tight">{slotName}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="bg-brown/5 text-brown border-none text-[10px] uppercase font-bold">
                          {shiftOrders.length} Stops Total
                        </Badge>
                        {isOut && <Badge className="bg-success/10 text-success border-none text-[10px] uppercase font-bold">Out for Delivery</Badge>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    <Button 
                      variant="outline" 
                      className="border-primary text-primary hover:bg-primary/5 h-12 px-6 font-bold"
                      onClick={() => {
                        const url = getMultiStopUrl(shiftOrders);
                        if (url) window.open(url, "_blank");
                        else toast.info("No active stops found for this route.");
                      }}
                    >
                      <Navigation className="w-5 h-5 mr-2" /> Route Overview
                    </Button>
                    
                    {!isOut && (
                      <Button 
                        onClick={() => bulkMarkOutForDelivery(shiftOrders)} 
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold h-12 px-6 shadow-lg shadow-amber-500/20"
                      >
                        📦 Dispatch All Orders
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div className="flex items-center gap-2 mb-4 text-muted-foreground uppercase text-[10px] font-bold tracking-widest">
                    <ShieldCheck className="w-4 h-4" /> Shift Manifesto & Verification
                  </div>
                  
                  <div className="space-y-4">
                    {shiftOrders.map((o, idx) => {
                      const snap: AddrSnap = o.address_snapshot || {};
                      const addr = o.addresses || {};
                      return (
                        <div key={o.id} className="group relative pl-10 pb-6 border-l-2 border-dashed border-border last:border-0 last:pb-0">
                          <div className="absolute left-[-11px] top-0 w-5 h-5 rounded-full bg-secondary border-2 border-border flex items-center justify-center text-[10px] font-bold text-brown group-hover:bg-primary group-hover:border-primary group-hover:text-white transition-colors">
                            {idx + 1}
                          </div>
                          
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 bg-secondary/5 rounded-2xl p-4 border border-transparent hover:border-primary/20 hover:bg-white transition-all">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-display font-bold text-brown text-base">{snap.full_name || "Customer"}</span>
                                <Badge variant="outline" className="text-[9px] font-mono border-border/50">#{o.id.slice(0, 8)}</Badge>
                              </div>
                              {(() => {
                                const address = {
                                  house_no: addr.house_no || snap.house_no || "",
                                  house_name: addr.building_name || addr.house_name || snap.address_line_1 || "Building",
                                  landmark: addr.landmark || snap.landmark || "",
                                  city: addr.city || snap.city || "Bangalore",
                                  state: addr.state || snap.state || "Karnataka",
                                  pincode: addr.pincode || snap.pincode || ""
                                };
                                return (
                                  <div className="text-sm font-medium text-slate-700 mt-1">
                                    📍 {address.house_no}, {address.house_name}
                                    {address.landmark ? `, Near ${address.landmark}` : ''}
                                    <br />
                                    {address.city}, {address.state} - {address.pincode}
                                  </div>
                                );
                              })()}
                              <div className="mt-3 flex items-center gap-2">
                                <div className="text-[10px] font-bold text-primary uppercase tracking-tighter bg-primary/10 px-2 py-0.5 rounded">
                                  Verification Note: Match with Bill ID #{o.id.slice(0, 8)}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 shrink-0">
                              <div className="flex gap-2">
                                {snap.phone && (
                                  <a href={`tel:${snap.phone}`}>
                                    <Button variant="outline" size="sm" className="h-9 w-9 p-0 border-border/50">
                                      <Phone className="w-4 h-4" />
                                    </Button>
                                  </a>
                                )}
                                <PartnerOrderCard order={o} onUpdate={orders.refetch} compact />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 mt-3 border-t border-slate-100 pt-3 ml-4 mr-4">
                            <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr.lat || 0)},${encodeURIComponent(addr.lng || 0)}`}
                              target="_blank" 
                              rel="noreferrer"
                              className="flex items-center gap-1.5 text-xs font-bold text-blue-600 border border-blue-200 px-4 py-2 rounded-xl hover:bg-blue-50 transition-colors"
                            >
                              📍 Navigate Stop
                            </a>

                            {o.order_status === "confirmed" && (
                              <button
                                onClick={async () => {
                                  const { error } = await supabase
                                    .from("orders")
                                    .update({ order_status: "out_for_delivery" })
                                    .eq("id", o.id);
                                  if (!error) {
                                    qc.invalidateQueries({ queryKey: ["partner_orders", user?.id] });
                                    toast.success("Order is now out for delivery!");
                                  }
                                }}
                                className="text-xs font-bold text-white bg-amber-500 px-4 py-2 rounded-xl hover:bg-amber-600 transition-colors ml-auto shadow-sm shadow-amber-500/20"
                              >
                                📦 Out for Delivery
                              </button>
                            )}

                            {o.order_status === "out_for_delivery" && (
                              <button
                                onClick={async () => {
                                  const { error } = await supabase
                                    .from("orders")
                                    .update({ order_status: "delivered" })
                                    .eq("id", o.id);
                                  if (!error) {
                                    qc.invalidateQueries({ queryKey: ["partner_orders", user?.id] });
                                    toast.success("Order marked as delivered!");
                                  }
                                }}
                                className="text-xs font-bold text-white bg-green-600 px-4 py-2 rounded-xl hover:bg-green-700 transition-colors ml-auto shadow-sm shadow-green-600/20"
                              >
                                ✓ Complete Delivery
                              </button>
                            )}

                            {o.order_status === "delivered" && (
                              <div className="text-xs font-bold text-green-600 bg-green-50 px-4 py-2 rounded-xl ml-auto border border-green-100 flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Delivered
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>
        )}
      </main>
    </div>
  );
};

export default Partner;