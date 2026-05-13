import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import Header from "@/components/site/Header";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, CheckCircle2, Package, Truck, MapPin, Repeat } from "lucide-react";

const STATUSES = ["placed", "confirmed", "packed", "out_for_delivery", "delivered"] as const;
const labels: Record<string, string> = {
  placed: "Order placed", confirmed: "Confirmed", packed: "Packed", out_for_delivery: "Out for delivery", delivered: "Delivered",
};

const OrderDetail = () => {
  const { id } = useParams();
  const [params] = useSearchParams();
  const success = params.get("success") === "1";
  const { user } = useAuth();
  const { add } = useCart();
  const nav = useNavigate();
  const [order, setOrder] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!id || !user) return;
    Promise.all([
      supabase.from("orders").select("*").eq("id", id).maybeSingle(),
      supabase.from("order_items").select("*").eq("order_id", id),
    ]).then(([o, it]) => {
      setOrder(o.data); setItems(it.data ?? []);
    });
  }, [id, user]);

  const reorder = () => {
    items.forEach(it => add({
      id: it.product_id || it.id,
      name: it.product_name,
      image: it.product_image || "",
      unit: it.unit,
      price: Number(it.price),
      discountPrice: Number(it.price),
    }, true));
    nav("/checkout");
  };

  const currentIdx = order ? STATUSES.indexOf(order.order_status) : -1;

  return (
    <div className="min-h-screen bg-background">
      <Seo title={`Order ${id?.slice(0,8).toUpperCase()} — Eggscellent`} />
      <Header />
      <main className="container max-w-2xl py-8">
        {success && (
          <div className="bg-success/10 border border-success/30 rounded-3xl p-6 mb-6 text-center animate-scale-in">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-2" />
            <h2 className="font-display font-bold text-brown text-xl tracking-tight">Order placed!</h2>
            <p className="text-sm text-muted-foreground mt-1">Your fresh eggs are on the way.</p>
          </div>
        )}

        {!order && <Skeleton className="h-64 rounded-3xl" />}

        {order && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="font-display font-bold text-brown text-2xl tracking-tight">Order #{order.id.slice(0, 8).toUpperCase()}</h1>
                <p className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
              </div>
              <Button variant="brown" size="sm" onClick={reorder}><Repeat className="w-4 h-4" /> Reorder</Button>
            </div>

            {/* Timeline */}
            <section className="bg-card rounded-3xl shadow-soft p-6 mb-4">
              <h3 className="font-display font-semibold text-brown mb-5">Order timeline</h3>
              <ol className="relative pl-7 space-y-5">
                <span className="absolute left-[11px] top-1 bottom-1 w-px bg-border" />
                {STATUSES.map((s, i) => {
                  const done = i <= currentIdx;
                  const active = i === currentIdx;
                  return (
                    <li key={s} className="relative">
                      <span className={`absolute -left-7 top-0.5 w-5 h-5 rounded-full grid place-items-center ${done ? "gradient-yolk shadow-yolk" : "bg-secondary"} ${active ? "ring-4 ring-primary/20" : ""}`}>
                        {done ? <Check className="w-3 h-3 text-brown" /> : <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full" />}
                      </span>
                      <div className={`font-semibold text-sm ${done ? "text-brown" : "text-muted-foreground"}`}>{labels[s]}</div>
                    </li>
                  );
                })}
              </ol>
            </section>

            {/* Items */}
            <section className="bg-card rounded-3xl shadow-soft p-6 mb-4">
              <h3 className="font-display font-semibold text-brown mb-4 flex items-center gap-2"><Package className="w-4 h-4" /> Items</h3>
              <div className="space-y-3">
                {items.map(it => (
                  <div key={it.id} className="flex gap-3 items-center">
                    {it.product_image && <img src={it.product_image} alt={it.product_name} className="w-12 h-12 rounded-lg object-cover" />}
                    <div className="flex-1">
                      <div className="font-semibold text-brown text-sm">{it.product_name}</div>
                      <div className="text-xs text-muted-foreground">{it.unit} · Qty {it.quantity}</div>
                    </div>
                    <div className="font-display font-bold text-brown">₹{Number(it.price) * it.quantity}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-border mt-5 pt-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>₹{order.subtotal}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Delivery</span><span>{order.delivery_fee === 0 ? "FREE" : `₹${order.delivery_fee}`}</span></div>
                {Number(order.discount) > 0 && <div className="flex justify-between text-success"><span>Discount</span><span>− ₹{order.discount}</span></div>}
                <div className="flex justify-between font-display font-bold text-brown pt-2 border-t border-border mt-2"><span>Total</span><span>₹{order.total}</span></div>
              </div>
            </section>

            {order.address_snapshot && (
              <section className="bg-card rounded-3xl shadow-soft p-6">
                <h3 className="font-display font-semibold text-brown mb-3 flex items-center gap-2"><MapPin className="w-4 h-4" /> Delivery address</h3>
                <div className="text-sm text-muted-foreground">
                  <div className="font-semibold text-brown">{order.address_snapshot.full_name} · {order.address_snapshot.phone}</div>
                  <div>{order.address_snapshot.address_line_1}{order.address_snapshot.address_line_2 ? `, ${order.address_snapshot.address_line_2}` : ""}</div>
                  <div>{order.address_snapshot.city}, {order.address_snapshot.state} {order.address_snapshot.pincode}</div>
                  {order.delivery_slot && <div className="mt-2 text-brown font-medium flex items-center gap-1.5"><Truck className="w-4 h-4" /> {order.delivery_slot}</div>}
                </div>
              </section>
            )}

            <div className="text-center mt-8">
              <Link to="/orders" className="text-sm text-brown font-semibold underline">← Back to all orders</Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default OrderDetail;
