import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ChevronRight } from "lucide-react";

const statusLabel: Record<string, string> = {
  placed: "Placed", confirmed: "Confirmed", packed: "Packed",
  out_for_delivery: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled",
};

const OrdersList = ({ limit }: { limit?: number }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let q = supabase.from("orders").select("id,total,order_status,created_at,coupon_code").eq("user_id", user.id).order("created_at", { ascending: false });
    if (limit) q = q.limit(limit);
    q.then(({ data }) => setOrders(data ?? []));
  }, [user, limit]);

  if (orders === null) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>;

  if (orders.length === 0) return (
    <div className="bg-card rounded-3xl shadow-soft p-10 text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-secondary grid place-items-center mb-4">
        <Package className="w-7 h-7 text-brown/60" />
      </div>
      <p className="font-display font-semibold text-brown">No orders yet</p>
      <p className="text-sm text-muted-foreground mt-1">Your fresh egg deliveries will show up here.</p>
      <Link to="/" className="inline-block mt-4 text-sm font-semibold text-brown underline">Shop now</Link>
    </div>
  );

  return (
    <div className="space-y-3">
      {orders.map(o => (
        <Link key={o.id} to={`/orders/${o.id}`} className="flex items-center gap-4 bg-card rounded-2xl p-4 shadow-soft hover:shadow-card transition-smooth">
          <div className="w-12 h-12 rounded-xl gradient-yolk grid place-items-center shrink-0"><Package className="w-5 h-5 text-brown" /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-display font-semibold text-brown">#{o.id.slice(0, 8).toUpperCase()}</div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-secondary text-brown">{statusLabel[o.order_status]}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{new Date(o.created_at).toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="font-display font-bold text-brown">₹{o.total}</div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </Link>
      ))}
    </div>
  );
};

export default OrdersList;