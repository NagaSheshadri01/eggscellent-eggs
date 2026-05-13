import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, MapPin, Package, User } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["placed","confirmed","packed","out_for_delivery","delivered","cancelled"];

const AdminOrderDetail = () => {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  const load = async () => {
    if (!id) return;
    const [{ data: o }, { data: it }] = await Promise.all([
      supabase.from("orders").select("*").eq("id", id).maybeSingle(),
      supabase.from("order_items").select("*").eq("order_id", id),
    ]);
    setOrder(o); setItems(it ?? []);
    if (o?.user_id) {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", o.user_id).maybeSingle();
      setProfile(p);
    }
  };
  useEffect(() => { load(); }, [id]);

  const updateStatus = async (s: string) => {
    const { error } = await supabase.from("orders").update({ order_status: s as any }).eq("id", id!);
    if (error) toast.error(error.message); else { toast.success("Status updated"); load(); }
  };

  if (!order) return <Skeleton className="h-96 rounded-2xl" />;

  const a = order.address_snapshot || {};

  return (
    <div className="max-w-3xl">
      <Link to="/admin/orders" className="text-sm text-muted-foreground hover:text-brown flex items-center gap-1 mb-4"><ArrowLeft className="w-4 h-4" /> All orders</Link>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-brown text-3xl tracking-tight">Order #{order.id.slice(0,8).toUpperCase()}</h1>
          <p className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
        </div>
        <Select value={order.order_status} onValueChange={updateStatus}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div className="bg-card rounded-2xl shadow-soft p-5">
          <h3 className="font-display font-semibold text-brown mb-3 flex items-center gap-2"><User className="w-4 h-4" /> Customer</h3>
          <div className="text-sm">
            <div className="font-semibold text-brown">{profile?.full_name || "—"}</div>
            <div className="text-muted-foreground">{profile?.email || "—"}</div>
            <div className="text-muted-foreground">{profile?.phone || "—"}</div>
          </div>
        </div>
        <div className="bg-card rounded-2xl shadow-soft p-5">
          <h3 className="font-display font-semibold text-brown mb-3 flex items-center gap-2"><MapPin className="w-4 h-4" /> Delivery address</h3>
          <div className="text-sm text-muted-foreground">
            <div className="font-semibold text-brown">{a.full_name} · {a.phone}</div>
            <div>{a.address_line_1}{a.address_line_2 ? `, ${a.address_line_2}` : ""}</div>
            <div>{a.city}, {a.state} {a.pincode}</div>
            {order.delivery_slot && <div className="mt-2 text-brown">{order.delivery_slot}</div>}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-soft p-5">
        <h3 className="font-display font-semibold text-brown mb-3 flex items-center gap-2"><Package className="w-4 h-4" /> Items</h3>
        <div className="space-y-3">
          {items.map(it => (
            <div key={it.id} className="flex gap-3 items-center">
              {it.product_image && <img src={it.product_image} alt={it.product_name} className="w-12 h-12 rounded-lg object-cover" />}
              <div className="flex-1"><div className="font-semibold text-brown text-sm">{it.product_name}</div><div className="text-xs text-muted-foreground">{it.unit} · Qty {it.quantity}</div></div>
              <div className="font-display font-bold text-brown">₹{Number(it.price) * it.quantity}</div>
            </div>
          ))}
        </div>
        <div className="border-t border-border mt-5 pt-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>₹{order.subtotal}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Delivery</span><span>{order.delivery_fee === 0 ? "FREE" : `₹${order.delivery_fee}`}</span></div>
          {Number(order.discount) > 0 && <div className="flex justify-between text-success"><span>Discount</span><span>− ₹{order.discount}</span></div>}
          <div className="flex justify-between font-display font-bold text-brown pt-2 border-t border-border mt-2"><span>Total</span><span>₹{order.total}</span></div>
          <div className="flex justify-between text-xs text-muted-foreground"><span>Payment</span><span>{order.payment_method} · {order.payment_status}</span></div>
        </div>
      </div>
    </div>
  );
};

export default AdminOrderDetail;