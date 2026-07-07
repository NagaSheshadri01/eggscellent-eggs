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
import { Check, MapPin, Clock, CreditCard, Loader2, Tag, Wallet, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import AddressPicker from "@/components/site/AddressPicker";
import JitVerifySheet from "@/components/site/JitVerifySheet";
import { useProfileCompleteness } from "@/hooks/useProfileCompleteness";
import { useCoupons, type Coupon } from "@/hooks/useCoupons";
import { useOffers, type Offer } from "@/hooks/useOffers";
import { payNow } from "@/lib/payments/razorpay";
import { format } from "date-fns";
import { useSubscriptionPlans } from "@/hooks/useSubscriptionPlans";
import { useDeliverySlots } from "@/hooks/useDeliverySlots";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useDeliveryConfig } from "@/hooks/useDeliveryConfig";
import { evaluateTieredDeliveryFee } from "@/utils/distance";



const Checkout = () => {
  const { items, total, clear, appliedCoupon, setAppliedCoupon, discount, grandTotal, selectedAddressId } = useCart();
  const { data: activePlans } = useSubscriptionPlans();
  const { data: dbSlots } = useDeliverySlots(true);
  const { data: appSettings } = useAppSettings();
  const { data: deliveryConfig } = useDeliveryConfig();
  const hasSubscriptionInCart = items.some(item => item.purchase_type === 'subscription');
  const hasOnlySubscriptions = items.length > 0 && items.every(i => i.purchase_type === 'subscription');
  const { user } = useAuth();
  const nav = useNavigate();
  const { isComplete, missing, hasPhone, refetch: refetchProfile, isLoading: profileLoading } = useProfileCompleteness();
  const { data: availableOffers } = useOffers({ onlyActive: true });
  
  const [step, setStep] = useState(1);
  const [selectedAddr, setSelectedAddr] = useState<string>(selectedAddressId || "");

  // Fetch dynamic distance-based delivery fee
  const { data: dynamicDeliveryFee, isFetching: loadingDeliveryFee } = useQuery({
    queryKey: ['delivery-fee', selectedAddr, deliveryConfig],
    queryFn: async () => {
      if (!selectedAddr || !deliveryConfig) return null;
      const { data: addr, error } = await supabase.from("addresses").select("lat, lng").eq("id", selectedAddr).maybeSingle();
      if (error || !addr || !addr.lat) return 30; // fallback

      return evaluateTieredDeliveryFee(
        { lat: deliveryConfig.store_latitude, lng: deliveryConfig.store_longitude },
        { lat: addr.lat, lng: addr.lng },
        deliveryConfig.delivery_tiers
      );
    },
    enabled: !!selectedAddr && !!deliveryConfig
  });

  const deliveryFeeConfig = dynamicDeliveryFee !== null && dynamicDeliveryFee !== undefined ? dynamicDeliveryFee : 30;
  
  const isDeliveryFree = discount > 0 ? false : false; // Temporarily using discount or offers for this later, but for now we enforce the tiered fee
  const deliveryFee = deliveryFeeConfig;
  const calculatedDiscount = discount;
  const grand = Math.max(0, total + deliveryFee - calculatedDiscount);

  // Per-delivery cost = single drop, no monthly multiplier
  const perDeliveryCost = useMemo(() => {
    return items
      .filter(i => i.purchase_type === 'subscription')
      .reduce((s, i) => s + i.discountPrice * i.qty, 0);
  }, [items]);
  const projectedMonthlyTotal = grand; // monthly total with multiplier baked in

  const tomorrowStr = useMemo(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }, []);

  const { data: walletPrediction, isLoading: walletLoading } = useQuery({
    queryKey: ['user-wallet-prediction', user?.id, tomorrowStr],
    queryFn: async () => {
      if (!user) return null;
      const { data: profile } = await supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle();
      const currentBalance = Number(profile?.balance || 0);

      const { data: subs } = await supabase.from('subscriptions')
        .select('quantity, price_per_unit, paused_dates')
        .eq('user_id', user.id)
        .eq('status', 'active');
        
      let requiredFunds = 0;
      if (subs) {
        subs.forEach(sub => {
          if (sub.paused_dates && Array.isArray(sub.paused_dates) && sub.paused_dates.includes(tomorrowStr)) {
            return;
          }
          const qty = Number(sub.quantity || 1);
          const price = Number(sub.price_per_unit || 0);
          requiredFunds += (qty * price);
        });
      }
      return { currentBalance, requiredFunds };
    },
    enabled: !!user
  });

  const currentBalance = walletPrediction?.currentBalance || 0;
  const tomorrowsRequiredFunds = walletPrediction?.requiredFunds || 0;
  const remainingBalance = currentBalance - grand;
  const showWalletWarning = !walletLoading && (remainingBalance < tomorrowsRequiredFunds);

  // Keep existing checks for subscriptions in cart
  const isShortfundedForFirstDelivery = currentBalance < perDeliveryCost;
  const minimumNeededToActivate = Math.max(0, perDeliveryCost - currentBalance);
  
  const minOrderValue = deliveryConfig?.min_order_value || 150;
  const isBelowMinOrder = total < minOrderValue;

  const [slot, setSlot] = useState<string>("");
  const [payment, setPayment] = useState<"online" | "upi" | "cod" | "wallet">("online");
  const [coupon, setCoupon] = useState("");
  const [placing, setPlacing] = useState(false);
  const placedRef = useRef(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [addrServiceable, setAddrServiceable] = useState(true);
  const [checkingAddr, setCheckingAddr] = useState(false);
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);

  // Sync address from cart drawer pre-selection
  useEffect(() => {
    if (selectedAddressId && !selectedAddr) setSelectedAddr(selectedAddressId);
  }, [selectedAddressId]);

  useEffect(() => {
    if (dbSlots && dbSlots.length > 0) {
      if (hasSubscriptionInCart) {
        const subSlot = dbSlots.find(s => s.tag === 'subscription' || s.slot_key === 'subscription');
        if (subSlot) setSlot(subSlot.slot_key);
      } else {
        const firstOneTime = dbSlots.find(s => s.tag === 'one_time');
        if (firstOneTime) setSlot(firstOneTime.slot_key);
      }
    }
  }, [dbSlots, hasSubscriptionInCart]);

  // Real-time Qualification Engine for the offer cards on checkout page
  const offersWithEligibility = useMemo(() => {
    return (availableOffers || []).map(offer => ({
      ...offer,
      isEligible: total >= (Number(offer.min_order_value) || 0)
    }));
  }, [availableOffers, total]);


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
      .then(({ data }: any) => {
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

    // 1. Audit the slot matching logic right before checkout execution
    const actualSlotRow = dbSlots?.find(s => s.slot_key === slot || s.id === slot);

    console.dir({
      DEBUG_CHECKOUT_SLOT_STATE: {
        selectedSlotStateValue: slot,
        matchedSlotRowObject: actualSlotRow,
        finalResolvedKeyToSend: actualSlotRow?.slot_key || actualSlotRow?.id
      }
    });

    // 2. Hard runtime gate: Prevent the database constraint from ever being violated
    if (!actualSlotRow) {
      console.error("CRITICAL: Checkout aborted. The selected slot value does not match any valid row in the delivery_slots table.");
      setPlacing(false);
      alert("Error: Selected delivery slot is invalid. Please re-select your delivery time window.");
      return; 
    }

    // Enforce strict relational slot_key mapping
    const targetSlotKey = actualSlotRow?.slot_key;

    if (!targetSlotKey) {
      console.error("Core Data Mismatch: Selected slot row is missing its database 'slot_key' identifier.");
      setPlacing(false);
      toast.error("Delivery slot mapping configuration error. Please re-select a slot.");
      return;
    }

    const subItems = items.filter(i => i.purchase_type === 'subscription');
    const instantItems = items.filter(i => i.purchase_type === 'instant');

    if (subItems.length > 0) {
      const singleDeliveryCost = subItems.reduce((s, i) => s + i.discountPrice * i.qty, 0);
      const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle();
      const currentWalletBalance = wallet?.balance || 0;

      if (currentWalletBalance < singleDeliveryCost) {
        setPlacing(false);
        const difference = Math.max(0, singleDeliveryCost - currentWalletBalance);
        toast.error("Insufficient wallet balance. Redirecting to recharge...");
        nav(`/account/wallet?redirect=/checkout&recharge=${difference}`);
        return;

      }
    }

    // Online payment — simulate Razorpay first
    let onlinePaid = false;
    if (payment === "online") {
      const r = await payNow(grand);
      if (!r.ok) { setPlacing(false); toast.error("Payment failed"); return; }
      onlinePaid = true;
    }

    const { data: addr } = await supabase.from("addresses").select("*").eq("id", selectedAddr).maybeSingle();
    const lat = addr?.lat ?? null;
    const lng = addr?.lng ?? null;

    let orderIdToNavigate = "sub-success";

    if (subItems.length > 0) {
      const displayId = Math.random().toString(36).substring(2, 10).toUpperCase();
      const { data: subContract, error: contractErr } = await supabase.from("subscriptions").insert({
        user_id: user.id,
        address_id: selectedAddr,
        status: 'active',
        payment_method: 'wallet',
        wallet_mode: 'TRUE',
        display_id: displayId,
      }).select().single();

      if (contractErr || !subContract) {
        setPlacing(false);
        return toast.error("Failed to setup subscriptions: " + contractErr.message);
      }

      const itemsRows = subItems.map(i => {
        const plan = activePlans?.find(p => p.product_slug === i.slug && p.frequency_type === i.frequency_type);
        const isWeekly = i.frequency_type === 'weekly';
        const isAlternate = i.frequency_type === 'alternate';
        return {
          subscription_id: subContract.id,
          product_slug: i.slug || '',
          quantity: i.qty,
          frequency: i.frequency_type,
          selected_days: i.subscription_days || (isWeekly ? [3] : (isAlternate ? [0,2,4] : [0,1,2,3,4,5,6])),
        };
      });

      const subErr = null; // Deprecated, columns moved to subscriptions
        
      if (subErr) {
        setPlacing(false);
        return toast.error("Failed to setup subscription items: " + subErr.message);
      }

      // IMMEDIATE downstream delivery manifest generator execution post-subscription success:
      const deliveryDates: string[] = [];
      const today = new Date();
      for (let i = 1; i <= 14; i++) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + i);
        const dateString = targetDate.toISOString().split('T')[0];
        deliveryDates.push(dateString);
      }

      const deliveryPayloads = deliveryDates.map(date => ({
        display_id: Math.random().toString(36).substring(2, 10).toUpperCase(),
        user_id: user.id,
        subscription_id: subContract.id,
        delivery_date: date,
        delivery_slot_key: targetSlotKey,
        status: 'pending',
        delivery_address_id: selectedAddr
      }));

      const { error: deliveryGenError } = await (supabase as any)
        .from('manifest_drops')
        .insert(deliveryPayloads);
        
      if (deliveryGenError) {
        console.error("Downstream calendar generation failed:", deliveryGenError);
      }
    }

    if (instantItems.length > 0 || (subItems.length === 0 && items.length === 0)) {
      if (payment === "wallet") {
        const { error } = await supabase.rpc('deduct_wallet', { uid: user.id, amount: grand });
        if (error) { setPlacing(false); toast.error("Wallet deduction failed"); return; }
        onlinePaid = true;
      }
      
      const { data: order, error } = await supabase.from("one_time_orders").insert({
        user_id: user.id,
        delivery_address_id: selectedAddr,
        total_amount: grand,
        status: "pending", // <-- FIXED: Always defaults to pending for Admin assignment
        payment_method: (payment === "online" ? "upi" : payment),
        payment_status: payment === "cod" ? "pending" : (onlinePaid ? "paid" : "pending"),
        delivery_slot_key: targetSlotKey,
        display_id: Math.random().toString(36).substring(2, 10).toUpperCase(),
        delivery_date: format(new Date(), "yyyy-MM-dd") // Just using today for checkout
      }).select().single();
      
      if (error || !order) { setPlacing(false); return toast.error(error?.message || "Could not place order"); }
      orderIdToNavigate = order.id;

      if (instantItems.length > 0) {
        const itemsRows = instantItems.map(i => ({
          order_id: order.id,
          product_slug: i.slug || i.id,
          quantity: i.qty,
          price: i.discountPrice,
        }));
        const { error: e2 } = await supabase.from("one_time_order_items").insert(itemsRows);
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
          <AddressPicker 
            showSelect 
            selectedId={selectedAddr} 
            onSelect={(id) => { 
              setSelectedAddr(id); 
              setStep(s => Math.max(s, 2)); 
              setIsAddressFormOpen(false);
            }} 
            onFormToggle={(isOpen) => {
              setIsAddressFormOpen(isOpen);
              if (isOpen) setSelectedAddr("");
            }}
          />
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
              {dbSlots
                ?.filter(s => hasSubscriptionInCart ? s.tag === 'subscription' : s.tag === 'one_time')
                ?.map((s) => (
                  <button key={s.id} onClick={() => { setSlot(s.slot_key); setStep(st => Math.max(st, 2)); }} className={`px-4 py-3 rounded-xl text-sm font-medium border transition-smooth ${slot === s.slot_key ? "border-primary bg-primary/10 text-brown" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                    {s.label}
                  </button>
                ))
              }
            </div>
          </section>
        )}

        {/* Payment */}
        {hasSubscriptionInCart ? (
          <section className="bg-card rounded-3xl shadow-soft p-5 sm:p-6 mb-4">
            <h2 className="font-display font-semibold text-brown text-lg flex items-center gap-2 mb-2">
              <Wallet className="w-5 h-5 text-primary" /> Payment Mode: Prepaid Wallet
            </h2>
            <div className="p-3.5 bg-secondary/20 border border-border rounded-xl">
              <p className="text-sm text-muted-foreground">Subscriptions are automatically fulfilled using your prepaid wallet balance.</p>
            </div>
          </section>
        ) : (
          <section className="bg-card rounded-3xl shadow-soft p-5 sm:p-6 mb-4">
            <h2 className="font-display font-semibold text-brown text-lg flex items-center gap-2 mb-4"><CreditCard className="w-5 h-5 text-primary" /> Payment method</h2>
            <RadioGroup value={payment} onValueChange={(v) => setPayment(v as "upi" | "cod" | "online" | "wallet")} className="space-y-2">
              {[
                { v: "online", label: "Pay online (Razorpay demo)", desc: "Simulated payment — completes instantly" },
                { v: "upi", label: "UPI", desc: "Pay via Google Pay, PhonePe, Paytm" },
                { v: "cod", label: "Cash on delivery", desc: "Pay when your eggs arrive" },
                { v: "wallet", label: "Pay via Wallet Balance", desc: currentBalance < grand ? `Insufficient wallet funds (Balance: ₹${currentBalance}) — Top up to use.` : `Deduct ₹${grand} from your wallet (Balance: ₹${currentBalance})`, disabled: currentBalance < grand }
              ].map((o: any) => (
                <label key={o.v} className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-smooth ${payment === o.v ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"} ${o.disabled ? "opacity-50 pointer-events-none grayscale" : ""}`}>
                  <RadioGroupItem value={o.v} disabled={o.disabled} />
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
        )}

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
            {hasSubscriptionInCart ? (
              <div className="flex justify-between text-muted-foreground">
                <span>Per Delivery Cost ({items.filter(i => i.purchase_type==='subscription').reduce((s,i)=>s+i.qty,0)} items)</span>
                <span className="font-semibold text-brown">₹{perDeliveryCost}</span>
              </div>
            ) : (
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal ({items.reduce((s, i) => s + i.qty, 0)} items)</span>
                <span>₹{total}</span>
              </div>
            )}
            {!hasSubscriptionInCart && (
              <div className="flex justify-between text-muted-foreground items-center">
                <span className="flex items-center gap-2">Delivery Charge {loadingDeliveryFee && <Loader2 className="w-3 h-3 animate-spin" />}</span>
                {loadingDeliveryFee ? (
                  <span className="animate-pulse bg-secondary w-10 h-4 rounded"></span>
                ) : (
                  <span className={deliveryFee === 0 ? "text-success font-semibold bg-success/10 px-2 py-0.5 rounded-md border border-success/20" : "font-semibold"}>
                    {deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}
                  </span>
                )}
              </div>
            )}
            {calculatedDiscount > 0 && (
              <div className="flex justify-between text-success font-medium">
                <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Discount ({appliedCoupon?.code})</span>
                <span>− ₹{calculatedDiscount}</span>
              </div>
            )}
            {!hasSubscriptionInCart && (
              <div className="flex justify-between font-display font-bold text-brown text-lg pt-3 mt-3 border-t border-border">
                <span>Grand Total</span>
                <span>₹{grand}</span>
              </div>
            )}
          </div>
        </section>
      </main>

      <div className="fixed bottom-0 inset-x-0 bg-background/90 backdrop-blur-xl border-t border-border p-3 z-30 shadow-[0_-8px_24px_rgba(0,0,0,0.05)]">
        <div className="container max-w-3xl">
          {hasSubscriptionInCart && (
            <div className="mb-3">
              {!isShortfundedForFirstDelivery ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-800 text-sm">
                  ✓ Sufficient balance available! ₹{perDeliveryCost} will be debited per delivery. (Current Wallet: ₹{currentBalance})
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900 text-sm space-y-1">
                  <p className="font-semibold">⚠️ Minimum Balance Required</p>
                  <p>Your current wallet balance is <strong>₹{currentBalance}</strong>. A minimum of <strong>₹{perDeliveryCost}</strong> (1 delivery) is required to activate this schedule.</p>
                  <p className="text-xs text-stone-500 mt-1">* Recharge whatever amount you prefer to cover future deliveries.</p>
                </div>
              )}
            </div>
          )}

          {isBelowMinOrder && (
            <div className="mb-3 bg-red-50 text-red-700 p-3 rounded-lg font-medium text-sm border border-red-100">
              Minimum order value for delivery is ₹{minOrderValue}. Please add ₹{minOrderValue - total} more to proceed!
            </div>
          )}

          {showWalletWarning && !hasSubscriptionInCart && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm font-medium flex items-start gap-3 shadow-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
              <p>Heads up! This purchase will leave you with insufficient funds for tomorrow's scheduled deliveries. Please recharge your wallet soon.</p>
            </div>
          )}

          <div className="flex gap-3 items-end">
            <div className="flex-1 pb-1">
              <div className="text-xs text-muted-foreground">{hasSubscriptionInCart ? 'Per Delivery' : 'Total'}</div>
              <div className="font-display font-bold text-brown text-xl">{hasSubscriptionInCart ? `₹${perDeliveryCost}` : `₹${grand}`}</div>
            </div>
            
            {isAddressFormOpen ? null : hasSubscriptionInCart && isShortfundedForFirstDelivery ? (
              <Button
                variant="hero" size="lg" className="flex-[2] !bg-amber-500 hover:!bg-amber-600 !text-white !border-amber-600"
                onClick={() => nav(`/account/wallet?redirect=/checkout&recharge=${minimumNeededToActivate}`)}
                disabled={profileLoading || !addrServiceable || checkingAddr}
              >
                Go to Wallet to Recharge • Min Add ₹{minimumNeededToActivate}
              </Button>
            ) : (
              <Button
                variant="hero" size="lg" className="flex-[2]"
                onClick={placeOrder}
                disabled={placing || !selectedAddr || profileLoading || !addrServiceable || checkingAddr || isBelowMinOrder}
                title={!hasPhone ? `Please verify your phone first` : (!addrServiceable ? "Location not serviceable" : undefined)}
              >
                {placing || checkingAddr ? <Loader2 className="w-4 h-4 animate-spin" /> : (!addrServiceable ? "Location Not Serviceable" : "Place order")}
              </Button>
            )}
          </div>
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
