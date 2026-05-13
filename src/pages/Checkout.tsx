import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/site/Header";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Check, MapPin, Clock, CreditCard, Loader2, Tag } from "lucide-react";
import AddressPicker from "@/components/site/AddressPicker";
import JitVerifySheet from "@/components/site/JitVerifySheet";
import { useProfileCompleteness } from "@/hooks/useProfileCompleteness";
import { payNow } from "@/lib/payments/razorpay";

const slots = ["Tomorrow 6–8 AM", "Tomorrow 8–10 AM", "Tomorrow 10–11 AM"];

const Checkout = () => {
  const { items, total, clear } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const { isComplete, missing, refetch: refetchProfile, isLoading: profileLoading } = useProfileCompleteness();

  const [step, setStep] = useState(1);
  const [selectedAddr, setSelectedAddr] = useState<string>("");
  const [slot, setSlot] = useState(slots[0]);
  const [payment, setPayment] = useState<"online" | "upi" | "cod">("online");
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [placing, setPlacing] = useState(false);
  const placedRef = useRef(false);
  const [verifyOpen, setVerifyOpen] = useState(false);

  useEffect(() => { if (!items.length && !placedRef.current) nav("/"); }, [items, nav]);

  // Open the JIT verify sheet automatically when profile is incomplete
  useEffect(() => {
    if (!profileLoading && user && !isComplete) setVerifyOpen(true);
  }, [profileLoading, user, isComplete]);

  const deliveryFee = total >= 199 ? 0 : 29;
  const discount = appliedCoupon?.discount ?? 0;
  const grand = Math.max(0, total + deliveryFee - discount);

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    const { data, error } = await supabase.from("coupons").select("*").eq("code", coupon.trim().toUpperCase()).eq("active", true).maybeSingle();
    if (error || !data) return toast.error("Invalid coupon");
    if (data.expiry && new Date(data.expiry) < new Date()) return toast.error("Coupon expired");
    const disc = data.discount_type === "percent"
      ? Math.round((total * Number(data.discount_value)) / 100)
      : Number(data.discount_value);
    setAppliedCoupon({ code: data.code, discount: disc });
    toast.success(`Coupon ${data.code} applied`);
  };

  const placeOrder = async () => {
    if (!user) { nav("/auth?next=/checkout"); return; }
    if (!selectedAddr) return toast.error("Choose an address");
    if (!isComplete) { setVerifyOpen(true); return; }
    setPlacing(true);

    // Online payment — simulate Razorpay first
    let onlinePaid = false;
    if (payment === "online") {
      const r = await payNow(grand);
      if (!r.ok) { setPlacing(false); toast.error("Payment failed"); return; }
      onlinePaid = true;
    }

    const { data: addr } = await supabase.from("addresses").select("*").eq("id", selectedAddr).maybeSingle();
    const lat = (addr as any)?.lat ?? null;
    const lng = (addr as any)?.lng ?? null;
    const { data: order, error } = await supabase.from("orders").insert({
      user_id: user.id,
      address_id: selectedAddr,
      address_snapshot: addr as any,
      subtotal: total,
      delivery_fee: deliveryFee,
      discount,
      total: grand,
      payment_method: (payment === "online" ? "upi" : payment) as any,
      payment_status: payment === "cod" ? "pending" : (onlinePaid ? "paid" : "pending"),
      order_status: "placed",
      delivery_slot: slot,
      coupon_code: appliedCoupon?.code,
      lat, lng,
      pincode: (addr as any)?.pincode ?? null,
    } as any).select().single();
    if (error || !order) { setPlacing(false); return toast.error(error?.message || "Could not place order"); }

    const itemsRows = items.map(i => ({
      order_id: order.id,
      product_id: i.id,
      product_name: i.name,
      product_image: i.image,
      unit: i.unit,
      quantity: i.qty,
      price: i.discountPrice,
    }));
    const { error: e2 } = await supabase.from("order_items").insert(itemsRows);
    setPlacing(false);
    if (e2) return toast.error(e2.message);
    placedRef.current = true;
    clear();
    nav(`/orders/${order.id}?success=1`);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container max-w-md py-16 text-center">
          <h1 className="font-display font-bold text-brown text-2xl mb-4">Sign in to continue</h1>
          <Button variant="hero" size="lg" className="w-full" onClick={() => nav("/auth?next=/checkout")}>Sign in</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Seo title="Checkout — Eggscellent" />
      <Header />
      <main className="container max-w-3xl py-8 pb-32">
        <h1 className="font-display font-bold text-brown text-3xl tracking-tight mb-6">Checkout</h1>

        {/* Steps progress */}
        <div className="flex items-center gap-2 mb-8">
          {[1,2,3].map(s => (
            <div key={s} className={`flex-1 h-1.5 rounded-full transition-smooth ${step >= s ? "bg-primary" : "bg-secondary"}`} />
          ))}
        </div>

        {/* Address */}
        <section className="bg-card rounded-3xl shadow-soft p-5 sm:p-6 mb-4">
          <h2 className="font-display font-semibold text-brown text-lg flex items-center gap-2 mb-4"><MapPin className="w-5 h-5 text-primary" /> Delivery address</h2>
          <AddressPicker showSelect selectedId={selectedAddr} onSelect={setSelectedAddr} />
        </section>

        {/* Slot */}
        <section className="bg-card rounded-3xl shadow-soft p-5 sm:p-6 mb-4">
          <h2 className="font-display font-semibold text-brown text-lg flex items-center gap-2 mb-4"><Clock className="w-5 h-5 text-primary" /> Delivery slot</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {slots.map(s => (
              <button key={s} onClick={() => setSlot(s)} className={`px-4 py-3 rounded-xl text-sm font-medium border transition-smooth ${slot === s ? "border-primary bg-primary/10 text-brown" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                {s}
              </button>
            ))}
          </div>
        </section>

        {/* Payment */}
        <section className="bg-card rounded-3xl shadow-soft p-5 sm:p-6 mb-4">
          <h2 className="font-display font-semibold text-brown text-lg flex items-center gap-2 mb-4"><CreditCard className="w-5 h-5 text-primary" /> Payment method</h2>
          <RadioGroup value={payment} onValueChange={(v) => setPayment(v as any)} className="space-y-2">
            {[
              { v: "online", label: "Pay online (Razorpay demo)", desc: "Simulated payment — completes instantly" },
              { v: "upi", label: "UPI", desc: "Pay via Google Pay, PhonePe, Paytm" },
              { v: "cod", label: "Cash on delivery", desc: "Pay when your eggs arrive" },
            ].map(o => (
              <label key={o.v} className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-smooth ${payment === o.v ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                <RadioGroupItem value={o.v} />
                <div className="flex-1">
                  <div className="font-semibold text-brown text-sm">{o.label}</div>
                  <div className="text-xs text-muted-foreground">{o.desc}</div>
                </div>
                {payment === o.v && <Check className="w-4 h-4 text-success" />}
              </label>
            ))}
          </RadioGroup>
          <p className="text-xs text-muted-foreground mt-3">Razorpay flow is in demo mode — production keys can be wired in <code>src/lib/payments/razorpay.ts</code>.</p>
        </section>

        {/* Coupon + Summary */}
        <section className="bg-card rounded-3xl shadow-soft p-5 sm:p-6">
          <div className="flex gap-2 mb-5">
            <div className="relative flex-1">
              <Tag className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input className="pl-9" placeholder="Coupon code" value={coupon} onChange={e => setCoupon(e.target.value)} />
            </div>
            <Button variant="brown" onClick={applyCoupon}>Apply</Button>
          </div>

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>₹{total}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Delivery</span><span className={deliveryFee === 0 ? "text-success font-semibold" : ""}>{deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}</span></div>
            {discount > 0 && <div className="flex justify-between text-success"><span>Discount ({appliedCoupon?.code})</span><span>− ₹{discount}</span></div>}
            <div className="flex justify-between font-display font-bold text-brown text-lg pt-2 mt-2 border-t border-border"><span>Total</span><span>₹{grand}</span></div>
          </div>
        </section>
      </main>

      <div className="fixed bottom-0 inset-x-0 bg-background/90 backdrop-blur-xl border-t border-border p-3 z-30">
        <div className="container max-w-3xl flex gap-3">
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="font-display font-bold text-brown text-xl">₹{grand}</div>
          </div>
          <Button
            variant="hero" size="lg" className="flex-1"
            onClick={placeOrder}
            disabled={placing || !selectedAddr || profileLoading}
            title={!isComplete ? `Please verify your ${missing} first` : undefined}
          >
            {placing && <Loader2 className="w-4 h-4 animate-spin" />} {payment === "online" ? `Pay ₹${grand}` : "Place order"}
          </Button>
        </div>
      </div>

      <JitVerifySheet
        open={verifyOpen && !!missing}
        missing={missing}
        blocking
        onOpenChange={setVerifyOpen}
        onComplete={async () => { await refetchProfile(); }}
      />
    </div>
  );
};

export default Checkout;
