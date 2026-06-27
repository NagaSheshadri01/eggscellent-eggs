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
    
    const fetchAllHistory = async () => {
      let q1 = supabase.from("one_time_orders").select("id,total_amount,status,created_at,coupon_code,display_id,one_time_order_items(product_slug,quantity,price,products(name,image_url))").eq("user_id", user.id).order("created_at", { ascending: false });
      if (limit) q1 = q1.limit(limit);
      
      let q2 = supabase.from("subscriptions").select("id, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
      if (limit) q2 = q2.limit(limit);

      const [oneTimeRes, subRes] = await Promise.all([q1, q2]);
      
      const merged = [
        ...(oneTimeRes.data || []).map(o => ({ ...o, type: 'one_time' })),
        ...(subRes.data || []).map(s => ({ ...s, type: 'subscription', display_id: `SUB-${s.id.slice(0,8).toUpperCase()}` }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      if (limit) setOrders(merged.slice(0, limit));
      else setOrders(merged);
    };

    fetchAllHistory();
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
          <div className="flex -space-x-4 shrink-0">
            {o.one_time_order_items?.slice(0, 3).map((item: any, i: number) => (
              <div key={i} className="w-12 h-12 rounded-xl border-2 border-card overflow-hidden bg-secondary">
                {item.products?.image_url ? (
                  <img src={item.products.image_url} alt={item.products.name || item.product_slug} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center"><Package className="w-5 h-5 text-brown" /></div>
                )}
              </div>
            ))}
            {(o.one_time_order_items?.length || 0) > 3 && (
              <div className="w-12 h-12 rounded-xl border-2 border-card bg-secondary text-brown font-semibold text-xs grid place-items-center">
                +{(o.one_time_order_items?.length || 0) - 3}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-display font-semibold text-brown">#{o.display_id || o.id.slice(0, 8).toUpperCase()}</div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-secondary text-brown">{statusLabel[o.status] || o.status}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              {o.one_time_order_items?.map((it: any) => it.products?.name || it.product_slug).join(", ")}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(o.created_at).toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="font-display font-bold text-brown">₹{o.total_amount}</div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </Link>
      ))}
    </div>
  );
};

export default OrdersList;