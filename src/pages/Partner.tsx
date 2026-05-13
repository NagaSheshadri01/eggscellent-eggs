import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Navigation, Package, Phone, ShieldCheck, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { usePartnerStatus } from "@/hooks/usePartnerStatus";
import Seo from "@/components/Seo";

type AddrSnap = {
  full_name?: string; phone?: string; address_line_1?: string; address_line_2?: string;
  city?: string; state?: string; pincode?: string; landmark?: string;
};

const STATUS_FLOW: Record<string, { next: string; label: string }> = {
  placed:           { next: "confirmed",        label: "Mark confirmed" },
  confirmed:        { next: "packed",           label: "Mark packed" },
  packed:           { next: "out_for_delivery", label: "Out for delivery" },
  out_for_delivery: { next: "delivered",        label: "Mark delivered" },
};

const PartnerOrderCard = ({ order, onUpdate }: { order: any; onUpdate: () => void }) => {
  const addr: AddrSnap = order.address_snapshot || {};
  const oneLine = [addr.address_line_1, addr.address_line_2, addr.city, addr.pincode].filter(Boolean).join(", ");
  const flow = STATUS_FLOW[order.order_status];

  const navUrl = order.lat && order.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${order.lat},${order.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(oneLine)}`;

  const advance = async () => {
    if (!flow) return;
    const { error } = await supabase.rpc("partner_update_order_status", {
      _order_id: order.id, _new_status: flow.next,
    });
    if (error) toast.error(error.message);
    else { toast.success(flow.label.replace("Mark ", "")); onUpdate(); }
  };

  return (
    <div className="bg-card rounded-2xl shadow-soft p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-xs text-muted-foreground">#{order.id.slice(0, 8)}</div>
          <div className="font-semibold text-brown">{addr.full_name || "Customer"}</div>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-brown">{order.order_status.replace(/_/g, " ")}</span>
      </div>
      <div className="text-sm text-muted-foreground flex items-start gap-2">
        <MapPin className="w-4 h-4 mt-0.5 shrink-0" /><span className="line-clamp-2">{oneLine}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> {order.delivery_slot || "Slot TBD"}</span>
        <span className="font-semibold text-brown">₹{order.total}</span>
      </div>
      <div className="flex gap-2">
        <a href={navUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
          <Button variant="brown" className="w-full" type="button"><Navigation className="w-4 h-4" /> Navigate</Button>
        </a>
        {addr.phone && (
          <a href={`tel:${addr.phone}`}>
            <Button variant="outline" type="button"><Phone className="w-4 h-4" /></Button>
          </a>
        )}
      </div>
      {flow && (
        <Button variant="hero" className="w-full" onClick={advance}>{flow.label}</Button>
      )}
    </div>
  );
};

const Partner = () => {
  const { user, signOut } = useAuth();
  const { data: status, isLoading: statusLoading } = usePartnerStatus();
  const qc = useQueryClient();

  const partnerId = status?.partner?.id;

  const orders = useQuery({
    queryKey: ["partner_orders", partnerId],
    enabled: !!partnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("delivery_partner_id", partnerId!)
        .neq("order_status", "delivered")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!partnerId) return;
    const ch = supabase
      .channel(`partner_orders_${partnerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `delivery_partner_id=eq.${partnerId}` },
        () => qc.invalidateQueries({ queryKey: ["partner_orders", partnerId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [partnerId, qc]);

  if (statusLoading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;

  if (!status?.isPartner) {
    return (
      <div className="min-h-screen bg-secondary/30 grid place-items-center px-4">
        <div className="bg-card rounded-3xl shadow-card p-8 max-w-md text-center">
          <ShieldCheck className="w-10 h-10 text-primary mx-auto mb-3" />
          <h1 className="font-display font-bold text-brown text-2xl">Partner access pending</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {status?.partner ? "Your application is awaiting admin approval." : "You're not registered as a delivery partner."}
          </p>
          <Link to="/delivery-partner"><Button variant="hero" className="mt-4">Apply now</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <Seo title="Partner dashboard — Eggscellent" />
      <header className="bg-card border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-brown">
            <ArrowLeft className="w-4 h-4" /> Eggscellent
          </Link>
          <div className="text-sm">
            <span className="font-display font-bold text-brown">Partner</span>
            <span className="text-muted-foreground"> · {(user?.email && !/@auth\.eggscellent\.app$/i.test(user.email)) ? user.email : user?.phone}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="w-4 h-4" /> Sign out</Button>
        </div>
      </header>
      <main className="container max-w-3xl py-8 space-y-4">
        <div>
          <h1 className="font-display font-bold text-brown text-3xl tracking-tight">Active deliveries</h1>
          <p className="text-sm text-muted-foreground">Tap a card to navigate, advance status when complete.</p>
        </div>
        {orders.isLoading && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" />
          </div>
        )}
        {orders.data && orders.data.length === 0 && (
          <div className="bg-card rounded-2xl shadow-soft p-10 text-center text-muted-foreground">
            No active deliveries. New orders assigned to you will appear here automatically.
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          {(orders.data ?? []).map((o: any) => (
            <PartnerOrderCard key={o.id} order={o} onUpdate={orders.refetch} />
          ))}
        </div>
      </main>
    </div>
  );
};

export default Partner;