import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, MapPin, Package, User, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const STATUSES = ["placed","confirmed","packed","out_for_delivery","delivered","cancelled","refunded"];

const AdminOrderDetail = () => {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);

  const load = async () => {
    if (!id) return;
    const [{ data: o }, { data: it }] = await Promise.all([
      (supabase as any).from("orders").select("*").eq("id", id).maybeSingle(),
      (supabase as any).from("order_items").select("*").eq("order_id", id),
    ]);
    setOrder(o); setItems(it ?? []);
    if (o && (o as any).user_id) {
      const { data: p } = await (supabase as any).from("profiles").select("*").eq("id", (o as any).user_id).maybeSingle();
      setProfile(p);
    }
  };
  useEffect(() => { load(); }, [id]);

  const updateStatus = async (s: string) => {
    const { error } = await (supabase as any).from("orders").update({ order_status: s as any }).eq("id", id!);
    if (error) toast.error(error.message); else { toast.success("Status updated"); load(); }
  };

  const handleInitiateRefund = async () => {
    if (parseFloat(refundAmount) <= 0 || isNaN(parseFloat(refundAmount))) {
      toast.error("Please specify a valid numeric amount to credit.");
      return;
    }

    setIsRefunding(true);
    const { data, error } = await (supabase as any).rpc('process_admin_wallet_refund', {
      target_order_id: order.id,
      refund_amount: parseFloat(refundAmount),
      refund_reason: refundReason || "Initiated via Admin Portal"
    });

    setIsRefunding(false);

    if (error) {
      toast.error(`Refund sequence failed: ${error.message}`);
      return;
    }

    toast.success(`Success! ₹${refundAmount} has been returned to the user's wallet.`);
    setRefundAmount("");
    setRefundReason("");
    load();
  };

  if (!order) return <Skeleton className="h-96 rounded-2xl" />;

  const a = order.address_snapshot || {};

  return (
    <div className="max-w-3xl">
      <Link to="/admin/orders" className="text-sm text-muted-foreground hover:text-brown flex items-center gap-1 mb-4"><ArrowLeft className="w-4 h-4" /> All orders</Link>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-brown text-3xl tracking-tight">Order #{order.custom_order_id || order.id.slice(0,8).toUpperCase()}</h1>
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
            {order.lat && order.lng && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${order.lat},${order.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors"
              >
                <MapPin className="w-3 h-3" /> Open in Google Maps
              </a>
            )}
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

      <div className="bg-red-50 rounded-2xl shadow-soft p-5 mt-4 border border-red-200">
        <h3 className="font-display font-semibold text-red-800 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> ⚠️ Adjust Order / Initiate Wallet Refund
        </h3>
        <div className="space-y-4">
          <div>
            <Label className="text-red-900">Refund Amount (₹)</Label>
            <Input 
              type="number" 
              placeholder="e.g. 150" 
              value={refundAmount} 
              onChange={(e) => setRefundAmount(e.target.value)} 
              className="bg-white border-red-300 focus-visible:ring-red-400"
            />
          </div>
          <div>
            <Label className="text-red-900">Refund Reason</Label>
            <Textarea 
              placeholder="Reason for refund..." 
              value={refundReason} 
              onChange={(e) => setRefundReason(e.target.value)}
              className="bg-white border-red-300 focus-visible:ring-red-400"
            />
          </div>
          <Button 
            variant="destructive" 
            onClick={handleInitiateRefund} 
            disabled={isRefunding || order.order_status === 'refunded'}
            className="w-full font-bold"
          >
            {isRefunding ? "Processing..." : (order.order_status === 'refunded' ? "Order Fully Refunded" : "Initiate Refund")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminOrderDetail;