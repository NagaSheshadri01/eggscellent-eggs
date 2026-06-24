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

const getDistanceKM = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
};

const optimizeStopSequence = (store: { lat: number; lng: number }, stops: any[]) => {
  if (stops.length <= 1) return stops;
  let optimized = [...stops];
  let improved = true;
  
  const calcTotalDist = (currentPath: any[]) => {
    let d = 0;
    let pos = store;
    for (const stop of currentPath) {
      d += getDistanceKM(pos.lat, pos.lng, Number(stop.latitude), Number(stop.longitude));
      pos = { lat: Number(stop.latitude), lng: Number(stop.longitude) };
    }
    return d;
  };

  let iterations = 0;
  while (improved && iterations < 150) {
    improved = false;
    iterations++;
    for (let i = 0; i < optimized.length - 1; i++) {
      for (let j = i + 1; j < optimized.length; j++) {
        let testPath = [...optimized];
        const slice = testPath.slice(i, j + 1).reverse();
        testPath.splice(i, slice.length, ...slice);

        if (calcTotalDist(testPath) < calcTotalDist(optimized)) {
          optimized = testPath;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }
  return optimized;
};

const generateMapLink = (store: { lat: number; lng: number }, sortedStops: any[]) => {
  const origin = `${store.lat},${store.lng}`;
  const waypointCoordinates = sortedStops
    .filter(stop => stop.status !== "delivered")
    .map(stop => {
      const addr = stop.addresses || stop.address;
      return addr?.lat && addr?.lng ? `${addr.lat},${addr.lng}` : null;
    })
    .filter(Boolean);
  
  if (waypointCoordinates.length === 0) return null;
  return `https://www.google.com/maps/dir/${origin}/${waypointCoordinates.join('/')}`;
};

const PartnerOrderCard = ({ order, onUpdate, compact }: { order: any; onUpdate: () => void; compact?: boolean }) => {
  const snap: AddrSnap = order.address_snapshot || {};
  const dbAddr = order.addresses || {};
  
  const flow = STATUS_FLOW[order.status];

  const advance = async () => {
    if (!flow) return;
    const { error } = await supabase.rpc("partner_update_order_status", { _order_id: order.id, _new_status: flow.next });
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
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
            #{order.id.slice(0, 8)} {order.custom_order_id && `(${order.custom_order_id})`}
          </div>
          <div className="font-display font-bold text-brown text-lg leading-tight">{snap.full_name || "Customer"}</div>
        </div>
        <Badge className="bg-primary/10 text-brown border-none text-[10px] uppercase tracking-tighter shrink-0">
          {order.status.replace(/_/g, " ")}
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
          <span className="font-semibold">{(order ).delivery_slots?.tag || order.delivery_slot || "Early Morning"}</span>
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

  const partnerId = (status )?.partner?.id;
  const [activeFeed, setActiveFeed] = useState<'instant' | 'subscription'>('instant');
  const [loc, setLoc] = useState<{lat: number, lng: number} | null>(null);
  const [warehouse, setWarehouse] = useState(WAREHOUSE_DEFAULT);

  // Phase 5: Driver Shift states and hooks
  const [completedStops, setCompletedStops] = useState<Record<string, boolean>>({});
  const [selectedIssueStopId, setSelectedIssueStopId] = useState<string | null>(null);
  
  const { data: productsList = [] } = useProducts({ onlyActive: false });

  useEffect(() => {
    const fetchWarehouse = async () => {
      const { data, error } = await (supabase.from("delivery_config") ).select("store_latitude, store_longitude").eq("id", 1).maybeSingle();
      if (data?.store_latitude && data?.store_longitude) {
        setWarehouse({ lat: data.store_latitude, lng: data.store_longitude });
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
        .from("one_time_orders")
        .select(`
          *,
          addresses(*),
          delivery_slots(*)
        ` )
        .eq("delivery_partner_id", user!.id)
        .in("status", ["confirmed", "out_for_delivery"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const getPartnerLocalDateString = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [todayStr, setTodayStr] = useState(() => getPartnerLocalDateString());
  const [tomorrowStr, setTomorrowStr] = useState(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return getPartnerLocalDateString(t);
  });

  useEffect(() => {
    const syncPartnerDateView = () => {
      if (document.visibilityState === 'visible') {
        setTodayStr(getPartnerLocalDateString());
        const t = new Date();
        t.setDate(t.getDate() + 1);
        setTomorrowStr(getPartnerLocalDateString(t));
        qc.invalidateQueries({ queryKey: ["driver-active-shift"] });
      }
    };
    document.addEventListener('visibilitychange', syncPartnerDateView);
    return () => document.removeEventListener('visibilitychange', syncPartnerDateView);
  }, [qc]);

  const [subscriptionTab, setSubscriptionTab] = useState<'today' | 'tomorrow'>('today');

  const { updateStopStatus } = useDriverShift(user?.id, todayStr);
  const subDeliveries = useQuery({
    queryKey: ["driver-active-shift", todayStr, tomorrowStr],
    enabled: !!user?.id && activeFeed === 'subscription',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_calendar_ledger')
        .select(`
          *,
          subscription_items (
            product_slug,
            quantity,
            subscriptions (
              user_id,
              profiles:user_id (id, full_name, phone),
              addresses:address_id (*)
            )
          )
        `)
        .eq('delivery_partner_id', user!.id)
        .in('delivery_date', [todayStr, tomorrowStr]);
      if (error) throw error;
      return (data ?? []) ;
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`partner_orders_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "one_time_orders", filter: `delivery_partner_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["partner_orders", user.id] }),
      )
      // Live sync: when admin changes a ledger row status (Out of Stock / Restore Stock),
      // instantly update the partner's tomorrow shift view without a manual refresh.
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "subscription_calendar_ledger" },
        () => qc.invalidateQueries({ queryKey: ["driver-active-shift"] }),
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
  const processedShifts = useMemo((): any[] => {
    const activeOrders = ((orders.data || [])).filter(o => o.status !== "delivered" && o.status !== "cancelled");
    
    const groups: Record<string, any[]> = {};
    activeOrders.forEach((o: any) => {
      const slotId = o.slot_id || "unassigned";
      if (!groups[slotId]) groups[slotId] = [];
      groups[slotId].push(o);
    });

    const shifts = Object.keys(groups).map(slotId => {
       const shiftOrders = groups[slotId];
       const slotObj = shiftOrders[0]?.delivery_slots || {};
       const slotName = slotId === "subscription" ? "📦 Early Morning Shift" : getSlotLabel(slotId);
       
       return {
          id: slotId,
          start_time: slotObj.start_time ? `1970-01-01T${slotObj.start_time}Z` : new Date().toISOString(),
          shift_name: slotName,
          orders: shiftOrders,
          isOut: shiftOrders.some((o: any) => ["out_for_delivery", "delivered"].includes(o.status))
       };
    });

    shifts.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    return shifts.map(shift => {
       if (!shift.orders || shift.orders.length === 0) return shift;

       const rawStops = shift.orders.map((order: any) => ({
          order_id: order.id,
          latitude: order.addresses?.lat || order.addresses?.latitude,
          longitude: order.addresses?.lng || order.addresses?.longitude,
          customer_name: order.address_snapshot?.full_name || order.addresses?.full_name || "Customer",
          address_string: `${order.addresses?.building_name || order.addresses?.flat_building || order.address_snapshot?.address_line_1 || ''}, ${order.addresses?.area_locality || order.addresses?.city || ''}`,
          original_order: order
       }));

       const optimizedStops = optimizeStopSequence(warehouse, rawStops);
       return { ...shift, optimizedStops };
    });
  }, [orders.data, warehouse]);

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

  // Route link generated dynamically via generateMapLink

  const bulkMarkOutForDelivery = async (shiftOrders: any[]) => {
    const ids = shiftOrders.filter(o => o.status === "confirmed").map(o => o.id);
    if (ids.length === 0) {
      toast.info("No orders to dispatch in this shift.");
      return;
    }
    
    const { error } = await supabase.from("one_time_orders").update({ status: "out_for_delivery" }).in("id", ids);
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
          
          // Split stops by date bounds
          const todayStops = rawStops.filter((s: any) => s.delivery_date === todayStr);
          const tomorrowStops = rawStops.filter((s: any) => s.delivery_date === tomorrowStr);

          // Active stops logic (only filtering completed/inactive for today's live execution)
          const activeStops = todayStops.filter((s: any) => !completedStops[s.id] && s.status !== 'delivered' && s.status !== 'skipped' && s.status !== 'failed');
          const tomorrowActiveStops = tomorrowStops;

          const isFutureShift = subscriptionTab === 'tomorrow';
          const displayStops = isFutureShift ? tomorrowActiveStops : activeStops;

          // Master Orders already act as the group! We map them to the same structure.
          let groupedStops = displayStops.map((masterOrder: any) => {
            const userId = masterOrder.user_id;
            // Filter child ledger rows if needed (e.g. exclude failed ones for driver view)
            const activeItems = masterOrder.delivery_ledger?.filter((item: any) => item.status !== 'failed' && item.status !== 'skipped') || [];
            
            // Find an address
            let addr = {};
            activeItems.forEach((ledgerItem: any) => {
              if (ledgerItem.subscriptions?.addresses) {
                addr = ledgerItem.subscriptions.addresses;
              }
            });

            return {
              userId,
              customerInfo: masterOrder.profiles,
              address: addr,
              items: activeItems,
              master_order_id: masterOrder.id,
              custom_order_id: masterOrder.custom_order_id
            };
          }).filter((group: any) => group.items.length > 0);
          
          const mappedStops = groupedStops.map((stop: any) => ({
            ...stop,
            latitude: stop.address?.lat || stop.addresses?.lat,
            longitude: stop.address?.lng || stop.addresses?.lng
          }));
          groupedStops = optimizeStopSequence(warehouse, mappedStops);

          // Helper to count unique customer stops for badge tabs
          const getUniqueStopsCount = (itemsList: any[]) => {
            return itemsList.filter((mo: any) => 
              (mo.delivery_ledger || []).some((item: any) => item.status !== 'failed' && item.status !== 'skipped')
            ).length;
          };

          const todayStopsCount = getUniqueStopsCount(todayStops);
          const tomorrowStopsCount = getUniqueStopsCount(tomorrowStops);

          return (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="font-display font-bold text-brown text-3xl tracking-tight">Subscription Shifts</h1>
                  <p className="text-sm text-muted-foreground">
                    {isFutureShift ? `Tomorrow's pre-assigned schedule — ${tomorrowStr}` : `Today's recurring delivery queue — ${todayStr}`}
                  </p>
                </div>
                
                {/* Secondary Today vs Tomorrow Toggles */}
                {!subDeliveries.isLoading && (
                  <div className="flex gap-2 bg-card border border-border rounded-xl p-1 shadow-soft w-full max-w-xs self-start md:self-center">
                    <button
                      onClick={() => setSubscriptionTab('today')}
                      className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs transition-all ${
                        subscriptionTab === 'today' ? 'bg-primary/20 text-brown shadow-sm' : 'text-muted-foreground hover:text-brown'
                      }`}
                    >
                      Today's Shift ({todayStopsCount})
                    </button>
                    <button
                      onClick={() => setSubscriptionTab('tomorrow')}
                      className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs transition-all ${
                        subscriptionTab === 'tomorrow' ? 'bg-primary/20 text-brown shadow-sm' : 'text-muted-foreground hover:text-brown'
                      }`}
                    >
                      Tomorrow's Shift ({tomorrowStopsCount})
                    </button>
                  </div>
                )}
              </div>

              {subDeliveries.isLoading && <div className="space-y-3"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>}
              {subDeliveries.error && <div className="bg-destructive/10 text-destructive p-4 rounded-2xl text-sm">Error: {(subDeliveries.error ).message}</div>}

              {!subDeliveries.isLoading && groupedStops.length === 0 && (
                <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border animate-in fade-in duration-300">
                  <Repeat className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
                  <p className="font-display font-bold text-brown">
                    {isFutureShift ? "No subscription deliveries scheduled for tomorrow" : "No active subscription deliveries today"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isFutureShift ? "Stops will appear here in real-time as the admin maps tomorrow's dispatch manifest." : "All subscription stops have been successfully completed or exception-handled."}
                  </p>
                </div>
              )}

              {groupedStops.length > 0 && (() => {
                const routeUrl = groupedStops.length > 0 ? generateMapLink(warehouse, groupedStops) : null;

                return (
                  <div className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden animate-in fade-in duration-500">
                    <div className="p-6 border-b border-border/40 bg-secondary/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                          <Repeat className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="font-display font-bold text-brown text-xl">
                            {isFutureShift ? "🌅 Tomorrow's Pre-assigned Shift" : "🌅 Early Morning Subscription Shift"}
                          </h2>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {isFutureShift ? `${tomorrowStopsCount} stops mapped` : `${groupedStops.length} recurring stops remaining`}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {routeUrl && (
                          <a href={routeUrl} target="_blank" rel="noreferrer">
                            <Button variant="outline" className="border-primary text-primary hover:bg-primary/5 h-12 px-6 font-bold">
                              <Navigation className="w-4 h-4 mr-2" /> {isFutureShift ? "Preview Route" : "Continue Route"}
                            </Button>
                          </a>
                        )}
                        {!isFutureShift && activeStops.some((s: any) => s.status === 'scheduled') && (
                          <Button
                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold h-12 px-6 shadow-lg shadow-amber-500/20"
                            onClick={async () => {
                              const pendingIds = activeStops.filter((s: any) => s.status === 'scheduled').map((s: any) => s.id);
                              const { error } = await supabase.from('subscription_calendar_ledger').update({ status: 'out_for_delivery' }).in('id', pendingIds);
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
                        {groupedStops.map((stop: any, index: number) => {
                          return (
                            <div 
                              key={stop.userId}
                              className="transition-all duration-500 ease-out transform relative"
                            >
                              <div className="absolute top-2 right-2 z-10 bg-black/80 text-white px-2 py-0.5 rounded text-xs font-bold shadow-md">
                                📍 Stop #{index + 1} ({String.fromCharCode(66 + index)})
                              </div>
                              <SwipePartnerOrderCard
                                groupedStop={stop}
                                productsList={productsList}
                                isLocked={isFutureShift}
                                onConfirmDelivery={async () => {
                                  // Atomically confirm all scheduled items in this stop card
                                  for (const item of stop.items) {
                                    setCompletedStops(prev => ({ ...prev, [item.id]: true }));
                                    await updateStopStatus.mutateAsync({ stopId: item.id, type: 'subscription', status: 'delivered' });
                                  }
                                  toast.success("All products in this stop confirmed and wallet deducted successfully!");
                                }}
                                onLogIssue={(itemId) => {
                                  setSelectedIssueStopId(itemId);
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
                  await updateStopStatus.mutateAsync({ stopId, type: 'subscription', status });
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
          {processedShifts.map((shift, shiftIdx) => (
            <div key={shift.id} className={`p-5 rounded-2xl bg-white border ${shiftIdx === 0 ? 'border-amber-400 ring-2 ring-amber-400/10' : 'border-stone-200'} shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500`}>
              
              <div className="flex justify-between items-center border-b border-border/40 pb-4">
                <div>
                  <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${shiftIdx === 0 ? 'bg-amber-50 text-amber-700' : 'bg-stone-100 text-stone-600'}`}>
                    {shiftIdx === 0 ? '⚡ NEXT NEAREST UPCOMING SHIFT' : '🗓️ FUTURE SCHEDULED SHIFT'}
                  </span>
                  <h3 className="text-lg font-display font-extrabold text-brown mt-2">
                    {shift.start_time && shift.start_time !== new Date().toISOString() ? new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' : ''} {shift.shift_name}
                  </h3>
                </div>
                
                <div className="flex gap-2">
                   {!shift.isOut && (
                      <Button 
                        onClick={() => bulkMarkOutForDelivery(shift.orders)} 
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold h-10 px-4 shadow-lg shadow-amber-500/20"
                      >
                        🚀 Dispatch All
                      </Button>
                   )}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                {shift.optimizedStops?.map((stop: any, index: number) => {
                  const o = stop.original_order;
                  const snap: AddrSnap = o.address_snapshot || {};
                  return (
                    <div key={stop.order_id} className="flex flex-col p-4 bg-stone-50/50 rounded-xl border border-stone-200/60 gap-3 hover:border-primary/20 transition-all group">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 pt-1">
                          <div className="w-6 h-6 rounded-full bg-stone-900 text-white font-black text-xs flex items-center justify-center shadow-sm shrink-0 mt-0.5 group-hover:bg-primary transition-colors">
                            {String.fromCharCode(66 + (index % 26))}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-stone-800">{stop.customer_name}</p>
                            <p className="text-xs text-stone-500 font-medium truncate max-w-[200px] sm:max-w-[300px] mt-0.5">{stop.address_string}</p>
                            <div className="text-[10px] font-bold text-primary uppercase tracking-tighter bg-primary/10 px-2 py-0.5 rounded mt-2 inline-block">
                                Verification: Bill #{o.id.slice(0, 8)}{o.custom_order_id ? ` (${o.custom_order_id})` : ''}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-[10px] font-bold tracking-wide text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 shrink-0">
                            Stop #{index + 1}
                          </span>
                          {snap.phone && (
                              <a href={`tel:${snap.phone}`}>
                                <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-border/50">
                                  <Phone className="w-3 h-3" />
                                </Button>
                              </a>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between gap-2 pl-9 mt-1 border-t border-border/30 pt-3">
                        <div className="flex items-center gap-2">
                           <PartnerOrderCard 
                            order={o}
                            compact
                            onUpdate={() => qc.invalidateQueries({ queryKey: ["partner_orders"] })} 
                           />
                        </div>
                        <div className="flex items-center gap-2">
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.latitude || 0)},${encodeURIComponent(stop.longitude || 0)}`}
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                          >
                            🧭 Navigate
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          ))}
        </div>
        </div>
        )}
      </main>
    </div>
  );
};

export default Partner;