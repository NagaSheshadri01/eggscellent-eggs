import { useEffect, useRef, useState, useMemo } from "react";
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
import { useCoupons, type Coupon } from "@/hooks/useCoupons";
import { useOffers, type Offer } from "@/hooks/useOffers";
import { payNow } from "@/lib/payments/razorpay";

const slots = ["08:00 AM – 12:00 PM", "02:00 PM – 06:00 PM", "06:00 PM – 08:00 PM"];

const Checkout = () => {
  const { items, total, clear, appliedCoupon, setAppliedCoupon, discount, grandTotal, selectedAddressId } = useCart();
  const hasSubscriptionInCart = items.some(item => item.purchase_type === 'subscription');
  const hasOnlySubscriptions = items.length > 0 && items.every(i => i.purchase_type === 'subscription');
  const { user } = useAuth();
  const nav = useNavigate();
  const { isComplete, missing, hasPhone, refetch: refetchProfile, isLoading: profileLoading } = useProfileCompleteness();
  const { data: availableOffers } = useOffers({ onlyActive: true });

  const [step, setStep] = useState(1);
  const [selectedAddr, setSelectedAddr] = useState<string>(selectedAddressId || "");
  const [slot, setSlot] = useState(hasSubscriptionInCart ? "early_morning" : slots[0]);
  const [payment, setPayment] = useState<"online" | "upi" | "cod">("online");
  const [coupon, setCoupon] = useState("");
  const [placing, setPlacing] = useState(false);
  const placedRef = useRef(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [addrServiceable, setAddrServiceable] = useState(true);
  const [checkingAddr, setCheckingAddr] = useState(false);

  // Sync address from cart drawer pre-selection
  useEffect(() => {
    if (selectedAddressId && !selectedAddr) setSelectedAddr(selectedAddressId);
  }, [selectedAddressId]);

  // Ensure early morning slot when subscription present
  useEffect(() => {
    if (hasSubscriptionInCart) setSlot("early_morning");
  }, [hasSubscriptionInCart]);

  // Real-time Qualification Engine for the offer cards on checkout page
  const offersWithEligibility = useMemo(() => {
    return (availableOffers || []).map(offer => ({
      ...offer,
      isEligible: total >= (Number(offer.min_order_value) || 0)
    }));
  }, [availableOffers, total]);

  // calculatedDiscount comes from CartContext now
  const calculatedDiscount = discount;

  useEffect(() => { if (!items.length && !placedRef.current) nav("/"); }, [items, nav]);

  // Check if selected address is still serviceable
  useEffect(() => {
    if (!selectedAddr) return;
    const check = async () => {
      setCheckingAddr(true);
      const { data: addr } = await supabase.from("addresses").select("pincode").eq("id", selectedAddr).maybeSingle();
      if (addr?.pincode) {
        const { data: serv } = await supabase.from("serviceable_pincodes").select("pincode").eq("pincode", addr.pincode).eq("active", true).maybeSingle();
        setAddrServiceable(!!serv);
        if (!serv) toast.error("📍 This saved address is outside our current delivery zone. Please choose another.", { duration: 5000 });
      }
      setCheckingAddr(false);
    };
    check();
  }, [selectedAddr]);

  // Open the JIT verify sheet automatically when phone is missing
  useEffect(() => {
    if (!profileLoading && user && !hasPhone) setVerifyOpen(true);
  }, [profileLoading, user, hasPhone]);

  // Phase 1.2 — Server-side price re-hydration
  // Prevents stale localStorage prices from reaching the order insert.
  useEffect(() => {
    if (!items.length) return;
    const ids = items.map((i) => i.id.includes('-sub-') ? i.id.split('-sub-')[0] : i.id);
    supabase
      .from("products")
      .select("id, discounted_price, active")
      .in("id", ids)
      .then(({ data }) => {
        if (!data) return;
        let stale = false;
        const priceMap = Object.fromEntries(data.map((p) => [p.id, p]));
        items.forEach((item) => {
          const actualId = item.id.includes('-sub-') ? item.id.split('-sub-')[0] : item.id;
          const live = priceMap[actualId];
          if (!live) return; // product deleted — let placeOrder surface the DB error
          if (live.discounted_price !== item.discountPrice) {
            stale = true;
            // Mutate the CartContext item price in-place via the context's `add` method
            // is not possible here without a `setPrice` helper, so we write directly
            // to localStorage as a stop-gap and rely on a page reload.
            // A proper fix is a `syncPrices` action on CartContext (Phase 2 cleanup).
            item.discountPrice = Number(live.discounted_price);
          }
        });
        if (stale) {
          localStorage.setItem("cart", JSON.stringify(items));
          toast.warning("Prices have been updated to reflect the latest discounts");
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount — cart is already in memory

  const deliveryFee = total >= 199 ? 0 : 29;
  const grand = Math.max(0, total + deliveryFee - calculatedDiscount);

  const applyCoupon = async (manualCode?: string) => {
    const codeToTry = manualCode || coupon.trim().toUpperCase();
    if (!codeToTry) return;
    
    const { data, error } = await supabase.from("coupons").select("*").eq("code", codeToTry).eq("active", true).maybeSingle();
    if (error || !data) return toast.error("Invalid coupon");
    if (data.expiry && new Date(data.expiry) < new Date()) return toast.error("Coupon expired");
    
    if (total < (data.min_order_amount || 0)) {
      return toast.error(`Add ₹${(data.min_order_amount || 0) - total} more to use this coupon`);
    }

    setAppliedCoupon(data as unknown as Coupon);
    toast.success(`Coupon ${data.code} applied`);
  };

  const placeOrder = async () => {
    if (!user) { nav("/auth?next=/checkout"); return; }
    if (!selectedAddr) return toast.error("Choose an address");
    if (!hasPhone) { setVerifyOpen(true); return; }
    setPlacing(true);

    // Online payment — simulate Razorpay first
    let onlinePaid = false;
    if (payment === "online") {
      const r = await payNow(grand);
      if (!r.ok) { setPlacing(false); toast.error("Payment failed"); return; }
      onlinePaid = true;
    }

    const subItems = items.filter(i => i.purchase_type === 'subscription');
    const instantItems = items.filter(i => i.purchase_type === 'instant');

    const { data: addr } = await supabase.from("addresses").select("*").eq("id", selectedAddr).maybeSingle();
    const lat = (addr as any)?.lat ?? null;
    const lng = (addr as any)?.lng ?? null;

    let orderIdToNavigate = "sub-success";

    if (subItems.length > 0) {
      const { data: profile } = await (supabase as any).from('profiles').select('is_vip').eq('id', user.id).maybeSingle();
      const subRows = subItems.map(i => {
        // id was set as `${product.id}-sub-${freq}`
        const actualProductId = i.id.includes('-sub-') ? i.id.split('-sub-')[0] : i.id;
        return {
          user_id: user.id,
          product_slug: i.slug || '',
          product_id: actualProductId,
          quantity: i.qty,
          selected_days: i.subscription_days || [1,3,5],
          status: 'active',
          is_vip: profile?.is_vip || false,
          wallet_mode: true,
          address_id: selectedAddr
        };
      });
      
      const { error: subErr } = await (supabase as any).from('subscriptions').insert(subRows);
      if (subErr) {
        setPlacing(false);
        return toast.error("Failed to setup subscriptions: " + subErr.message);
      }
    }

    if (instantItems.length > 0 || (subItems.length === 0 && items.length === 0)) {
      const { data: order, error } = await supabase.from("orders").insert({
        user_id: user.id,
        address_id: selectedAddr,
        address_snapshot: addr as any,
        subtotal: total,
        delivery_fee: deliveryFee,
        discount: calculatedDiscount,
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
      orderIdToNavigate = order.id;

      if (instantItems.length > 0) {
        const itemsRows = instantItems.map(i => ({
          order_id: order.id,
          product_id: i.id,
          product_name: i.name,
          product_image: i.image,
          unit: i.unit,
          quantity: i.qty,
          price: i.discountPrice,
        }));
        const { error: e2 } = await supabase.from("order_items").insert(itemsRows);
        if (e2) {
          setPlacing(false);
          if (e2.message.includes("INSUFFICIENT_STOCK")) {
            return toast.error("Sorry, one or more items in your cart just went out of stock. Please update your cart");
          }
          return toast.error(e2.message);
        }
      }
    }

    setPlacing(false);
    placedRef.current = true;
    clear();
    if (orderIdToNavigate === "sub-success") {
      toast.success("Subscriptions activated successfully!");
      nav("/account?tab=subscriptions");
    } else {
      nav(`/order-success/${orderIdToNavigate}`);
    }
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
        <section className="bg-card rounded-3xl shadow-soft p-5 sm:p-6 mb-4" onClick={() => setStep(s => Math.max(s, 1))}>
          <h2 className="font-display font-semibold text-brown text-lg flex items-center gap-2 mb-4"><MapPin className="w-5 h-5 text-primary" /> Delivery address</h2>
          <AddressPicker showSelect selectedId={selectedAddr} onSelect={(id) => { setSelectedAddr(id); setStep(s => Math.max(s, 2)); }} />
        </section>

        {/* Slot */}
        {hasSubscriptionInCart ? (
          <section className="bg-card rounded-3xl shadow-soft p-5 sm:p-6 mb-4">
            <h2 className="font-display font-semibold text-brown text-lg flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-primary" /> Delivery slot
            </h2>
            <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-2">
              <span className="text-lg">☀️</span>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Delivery Schedule</span>
                <span className="text-sm font-medium text-amber-900">
                  Strictly Early Morning Delivery (Freshly dropped before 7:00 AM)
                </span>
              </div>
            </div>
          </section>
        ) : (
          <section className="bg-card rounded-3xl shadow-soft p-5 sm:p-6 mb-4">
            <h2 className="font-display font-semibold text-brown text-lg flex items-center gap-2 mb-1"><Clock className="w-5 h-5 text-primary" /> Delivery slot</h2>
            <p className="text-xs text-muted-foreground mb-4 ml-7">Standard Delivery Windows</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {slots.map(s => (
                <button key={s} onClick={() => { setSlot(s); setStep(st => Math.max(st, 2)); }} className={`px-4 py-3 rounded-xl text-sm font-medium border transition-smooth ${slot === s ? "border-primary bg-primary/10 text-brown" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                  {s}
                </button>
              ))}
            </div>
          </section>
        )}

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
          <h2 className="font-display font-semibold text-brown text-lg flex items-center gap-2 mb-4"><Tag className="w-5 h-5 text-primary" /> Offers & Coupons</h2>
          
          {/* Dynamic Offer Cards */}
          <div className="flex gap-3 overflow-x-auto pb-4 mb-4 no-scrollbar min-h-[110px]">
            {availableOffers === undefined ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex-none w-64 h-28 rounded-2xl bg-secondary/20 animate-pulse" />
              ))
            ) : offersWithEligibility.length > 0 ? (
              offersWithEligibility.map(offer => {
                const isActive = appliedCoupon?.code === offer.coupon_code_to_apply;
                return (
                  <div 
                    key={offer.id} 
                    className={`flex-none w-64 p-4 rounded-2xl border transition-all duration-300 ${
                      offer.isEligible 
                        ? (isActive ? "border-success bg-success/5 shadow-md" : "border-border hover:border-primary/40 bg-card") 
                        : "opacity-60 grayscale-[0.5] border-dashed border-border bg-secondary/10"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isActive ? "bg-success text-white" : "bg-primary/20 text-brown"}`}>
                        {offer.title}
                      </span>
                      {offer.isEligible && (
                        <button 
                          onClick={() => applyCoupon(offer.coupon_code_to_apply)}
                          className={`text-xs font-bold uppercase transition-smooth ${isActive ? "text-success" : "text-primary hover:underline"}`}
                        >
                          {isActive ? "Applied ✓" : "Apply"}
                        </button>
                      )}
                    </div>
                    <div className="font-mono font-bold text-brown text-sm">{offer.coupon_code_to_apply}</div>
                    <div className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{offer.description}</div>
                    {!offer.isEligible && (
                      <div className="mt-3 text-[10px] font-medium text-amber-600">
                        Add ₹{Number(offer.min_order_value) - total} more to unlock
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-4 bg-secondary/10 rounded-2xl border border-dashed border-border/60">
                <p className="text-[11px] text-muted-foreground font-medium italic">No active rewards available for your cart yet.</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 mb-6 pt-4 border-t border-border/40">
            <div className="relative flex-1">
              <Tag className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input className="pl-9 h-11" placeholder="Enter coupon manually" value={coupon} onChange={e => setCoupon(e.target.value.toUpperCase())} />
            </div>
            <Button variant="brown" className="h-11 px-6" onClick={() => applyCoupon()}>Apply</Button>
          </div>

          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>₹{total}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Delivery</span><span className={deliveryFee === 0 ? "text-success font-semibold" : ""}>{deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}</span></div>
            {calculatedDiscount > 0 && (
              <div className="flex justify-between text-success font-medium">
                <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Discount ({appliedCoupon?.code})</span>
                <span>− ₹{calculatedDiscount}</span>
              </div>
            )}
            <div className="flex justify-between font-display font-bold text-brown text-lg pt-3 mt-3 border-t border-border">
              <span>Grand Total</span>
              <span>₹{grand}</span>
            </div>
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
            disabled={placing || !selectedAddr || profileLoading || !addrServiceable || checkingAddr}
            title={!hasPhone ? `Please verify your phone first` : (!addrServiceable ? "Location not serviceable" : undefined)}
          >
            {placing || checkingAddr ? <Loader2 className="w-4 h-4 animate-spin" /> : (!addrServiceable ? "Location Not Serviceable" : (payment === "online" ? `Pay ₹${grand}` : "Place order"))}
          </Button>
        </div>
      </div>

      <JitVerifySheet
        open={verifyOpen && !hasPhone}
        missing={!hasPhone ? "phone" : null}
        blocking
        onOpenChange={setVerifyOpen}
        onComplete={async () => { await refetchProfile(); }}
      />
    </div>
  );
};

export default Checkout;
