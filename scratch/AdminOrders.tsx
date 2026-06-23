import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { getSlotLabel } from "@/constants/delivery";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Truck, CheckCircle2, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["placed", "confirmed", "out_for_delivery", "delivered", "cancelled"];
const PENDING = ["placed", "pending", "confirmed", "out_for_delivery"];

const AdminOrders = () => {
  const qc = useQueryClient();

  const { data: orders, isLoading: ordersLoading, error: ordersError, refetch: load } = useQuery<any[]>({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          addresses(pincode, lat, lng),
          order_items(product_name, product_id)
        ` as any)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data ?? [];
    },
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetPartner, setTargetPartner] = useState<string>("");
  const [tab, setTab] = useState<"all" | "today" | "pending" | "delivered" | "cancelled">("pending");
  const [q, setQ] = useState("");

  const { data: partners } = useQuery({
    queryKey: ["partners_active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_partners")
        .select("user_id, full_name");
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin_orders_sync")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "one_time_orders" },
        () => {
          qc.invalidateQueries({ queryKey: ["orders"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const update = async (id: string, status: string) => {
    const { error } = await (supabase as any).from("one_time_orders").update({ status: status as any }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Updated");
      load();
    }
  };

  const bulkAssign = async () => {
    if (!targetPartner) {
      toast.error("Please select a partner first");
      return;
    }

    console.log("BULK ASSIGN PAYLOAD:", {
      delivery_partner_id: targetPartner,
      order_status: "confirmed",
      affected_orders: selectedIds
    });

    const { data, error } = await (supabase as any)
      .from("orders")
      .update({
        delivery_partner_id: targetPartner,
        order_status: "confirmed" as any
      })
      .in("id", selectedIds)
      .select("id");

    if (error) {
      toast.error("Bulk assignment failed: " + error.message);
    } else if (data && data.length === 0) {
      toast.error("Assignment failed: No rows updated (Permission denied?)");
    } else {
      // Direct Hand-off Broadcast
      const channel = supabase.channel('dispatch_room');
      const ordersWithData = (orders ?? []).filter(o => selectedIds.includes(o.id));
      
      channel.send({
        type: 'broadcast',
        event: 'direct_assignment',
        payload: { 
          partnerId: targetPartner, 
          orders: ordersWithData 
        }
      });

      toast.success(`Successfully assigned ${selectedIds.length} orders to partner`);
      setSelectedIds([]);
      setTargetPartner("");
      load();
    }
  };

  const todayKey = new Date().toISOString().slice(0, 10);
  const filtered = (orders ?? []).filter(o => {
    const orderIdMatch = o.id.toLowerCase().includes(q.toLowerCase()) || (o.display_id && o.display_id.toLowerCase().includes(q.toLowerCase()));
    const snap = (o.address_snapshot as any) || {};
    const pincode = snap.pincode || "";
    const pincodeMatch = String(pincode).toLowerCase().includes(q.toLowerCase());
    
    if (q && !orderIdMatch && !pincodeMatch) return false;
    
    if (tab === "today") return o.created_at.slice(0, 10) === todayKey;
    if (tab === "pending") return PENDING.includes(o.status);
    if (tab === "delivered") return o.status === "delivered";
    if (tab === "cancelled") return o.status === "cancelled";
    return true;
  });

  const sortedOrders = [...filtered].sort((a, b) => {
    const aAssigned = !!a.delivery_partner_id;
    const bAssigned = !!b.delivery_partner_id;

    // Rule 1: If 'a' is unassigned (false) and 'b' is assigned (true), 'a' goes UP (-1)
    if (!aAssigned && bAssigned) return -1;
    
    // Rule 2: If 'a' is assigned (true) and 'b' is unassigned (false), 'a' goes DOWN (1)
    if (aAssigned && !bAssigned) return 1;

    // Rule 3: If they are in the same assignment group, sort by newest creation time first
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === sortedOrders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedOrders.map(o => o.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="relative pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="font-display font-bold text-brown text-3xl tracking-tight">Logistics Dispatch Board</h1>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1">{filtered.length} Orders</Badge>
          <Button variant="outline" size="sm" onClick={() => load()} className="h-8">Refresh</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-6">
        <TabsList className="bg-secondary/40 p-1">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="delivered">Delivered</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex gap-2 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search Order ID or Pincode..." 
            value={q} 
            onChange={e => setQ(e.target.value)} 
            className="pl-9 bg-card shadow-sm border-border" 
          />
        </div>
      </div>

      {ordersError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-2xl mb-6 text-sm">
          <p className="font-bold">Error loading orders:</p>
          <p>{(ordersError as any).message || "Unknown error"}</p>
        </div>
      )}

      <div className="bg-card rounded-2xl shadow-soft border border-border overflow-hidden">
        {ordersLoading ? <Skeleton className="h-80" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/60 text-xs uppercase text-muted-foreground font-bold border-b border-border">
                <tr>
                  <th className="px-4 py-4 w-10">
                    <Checkbox 
                      checked={selectedIds.length > 0 && selectedIds.length === filtered.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-4">Order Details</th>
                  <th className="px-4 py-4">Slot</th>
                  <th className="px-4 py-4">Pincode</th>
                  <th className="px-4 py-4 text-center">Map</th>
                  <th className="px-4 py-4">Payment</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {sortedOrders.map(o => {
                  const isAssigned = !!o.delivery_partner_id;
                  const snap = (o.address_snapshot as any) || {};
                  const slot = Array.isArray(o.delivery_slots) ? o.delivery_slots[0] : o.delivery_slots;
                  const addr = Array.isArray(o.addresses) ? o.addresses[0] : o.addresses;
                  const slotLabel = o.slot_id ? getSlotLabel(o.slot_id) : (slot?.label || "—");
                  
                  return (
                    <tr key={o.id} className={`border-b border-border/50 transition-colors ${
                      selectedIds.includes(o.id)
                        ? 'bg-primary/10'
                        : isAssigned
                          ? 'bg-green-50/60 border-green-200 hover:bg-green-50'  // ASSIGNED ARE GREEN (DOWN)
                          : 'bg-red-50/60 border-red-200 hover:bg-red-50'      // UNASSIGNED ARE RED (UP)
                    }`}>
                      <td className="px-4 py-4">
                        <Checkbox 
                          checked={selectedIds.includes(o.id)}
                          onCheckedChange={() => toggleSelect(o.id)}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-2">
                          <div>
                            <Link to={`/admin/orders/${o.id}`} className="text-brown font-mono font-bold text-xs hover:underline uppercase tracking-tight">
                              {o.display_id || `#${o.id.slice(0, 8)}`}
                            </Link>
                            <div className="flex flex-col mt-0.5">
                              <span className="text-[10px] font-semibold text-brown">{(o as any).profiles?.full_name || snap.full_name || "Customer"}</span>
                              <span className="text-[10px] text-muted-foreground">{new Date(o.created_at).toLocaleString()}</span>
                            </div>
                            <div className="mt-1">
                              <span className="text-xs text-stone-500 font-medium truncate w-64 block">
                                {o.one_time_order_items?.map((item: any) => `${(item.product_name || item.product_slug) || item.product?.name || 'Product'} - ${item.quantity || 1}N`).join(', ') || 'No products found'}
                              </span>
                            </div>
                          </div>
                          <div>
                            {!isAssigned ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                                ⚠️ UNASSIGNED
                              </span>
                            ) : (() => {
                              const partnerName = (partners || []).find((p: any) => p.user_id === o.delivery_partner_id)?.full_name || "Partner";
                              return (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-800">
                                  🚚 Assigned to: {partnerName}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="outline" className="font-medium text-[10px] bg-secondary/30 border-secondary-foreground/10 capitalize">
                          {slotLabel}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-semibold text-brown">{addr?.pincode || snap.pincode || "—"}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {addr?.lat && addr?.lng ? (
                          <a 
                            href={`http://maps.google.com/?q=${addr.lat},${addr.lng}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            title="View Pin"
                          >
                            <MapPin className="w-4 h-4" />
                          </a>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-brown">₹{o.total_amount}</span>
                          <span className="text-[10px] text-muted-foreground capitalize">{o.payment_status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Select value={o.status} onValueChange={(v) => update(o.id, v)}>
                          <SelectTrigger className="w-36 h-8 text-xs font-medium">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace(/_/g, " ")}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-4">
                        <Link to={`/admin/orders/${o.id}`} className="text-muted-foreground hover:text-brown">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-20">
                      <div className="flex flex-col items-center opacity-40">
                        <CheckCircle2 className="w-12 h-12 mb-2" />
                        <p className="font-display font-medium text-lg">No orders found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 animate-in fade-in slide-in-from-bottom-8 duration-300">
          <div className="bg-brown text-primary-foreground rounded-2xl shadow-2xl p-4 flex items-center justify-between gap-4 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                {selectedIds.length}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm">Orders Selected</span>
                <span className="text-[10px] text-primary/70">Assign to partner to mark as packed</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-1 max-w-xs">
              <Select value={targetPartner} onValueChange={setTargetPartner}>
                <SelectTrigger className="h-10 bg-white/10 border-white/20 text-white placeholder:text-white/50">
                  <SelectValue placeholder="Choose Partner..." />
                </SelectTrigger>
                <SelectContent>
                  {(partners || []).filter((p: any) => p.user_id).map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="hero" 
                className="h-10 px-6 whitespace-nowrap" 
                onClick={bulkAssign}
              >
                <Truck className="w-4 h-4 mr-2" /> Assign
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
