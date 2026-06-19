import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Minus, Plus, ShoppingBag, Trash2, Tag, Check, ChevronRight,
  MapPin, Truck, Gift, Zap, Package, CreditCard, Loader2, ArrowLeft, Repeat, Calendar, Wallet
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOffers, type Offer, type OfferType } from "@/hooks/useOffers";
import { useProducts } from "@/hooks/useProducts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { type Coupon } from "@/hooks/useCoupons";
import AddressPicker from "@/components/site/AddressPicker";
import SlotPicker from "@/components/site/SlotPicker";
import JitVerifySheet from "@/components/site/JitVerifySheet";
import { useProfileCompleteness } from "@/hooks/useProfileCompleteness";
import { payNow } from "@/lib/payments/razorpay";
import { useSubscriptionPlans } from "@/hooks/useSubscriptionPlans";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useDeliveryConfig } from "@/hooks/useDeliveryConfig";
import { evaluateTieredDeliveryFee } from "@/utils/distance";

type CheckoutStep = "cart" | "address" | "slots" | "payment";

const OFFER_ICONS: Record<OfferType, any> = {
  product_discount: Tag, free_delivery: Truck, product_free: Gift, bundle_buy: Package,
};

const CartDrawer = () => {
  const {
    items, open, setOpen, inc, dec, remove, add,
    total, count,
    appliedCoupon, setAppliedCoupon, discount, grandTotal,
    activeOffer, setActiveOffer, offerResult, evaluateOffer,
    selectedAddressId, setSelectedAddressId, clear, updateItems,
  } = useCart();

  const { user } = useAuth();
  const nav = useNavigate();
  const { hasPhone, refetch: refetchProfile, isLoading: profileLoading } = useProfileCompleteness();
  const { data: availableOffers } = useOffers({ onlyActive: true });
  const { data: allProducts } = useProducts({ onlyActive: true });

  const [step, setStep] = useState<CheckoutStep>("cart");
  const [payment, setPayment] = useState<"online" | "upi" | "cod">("cod");
  const [selectedSlotId, setSelectedSlotId] = useState<string>();
  const [deliveryDate, setDeliveryDate] = useState<Date>(new Date());
  const [placing, setPlacing] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [addrServiceable, setAddrServiceable] = useState(true);
  const [checkingAddr, setCheckingAddr] = useState(false);
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  const [selectedWeeklyDay, setSelectedWeeklyDay] = useState<number>(3); // Default to Wednesday [3]
  const placedRef = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const { data: activePlans } = useSubscriptionPlans();
  const { data: appSettings } = useAppSettings();
  const { data: deliveryConfig } = useDeliveryConfig();

  // Fetch dynamic distance-based delivery fee
  const { data: dynamicDeliveryFee } = useQuery({
    queryKey: ['delivery-fee', selectedAddressId, deliveryConfig],
    queryFn: async () => {
      if (!selectedAddressId || !deliveryConfig) return null;
      const { data: addr, error } = await (supabase as any).from("addresses").select("lat, lng").eq("id", selectedAddressId).maybeSingle();
      if (error || !addr || !addr.lat) return 30; // fallback

      return evaluateTieredDeliveryFee(
        { lat: deliveryConfig.store_latitude, lng: deliveryConfig.store_longitude },
        { lat: addr.lat, lng: addr.lng },
        deliveryConfig.delivery_tiers
      );
    },
    enabled: !!selectedAddressId && !!deliveryConfig
  });

  const hasWeeklySub = useMemo(() => {
    return items.some(item => item.purchase_type === 'subscription' && item.frequency_type === 'weekly');
  }, [items]);

  const hasSubscriptionInCart = useMemo(() => {
    return items.some(item => item.purchase_type === 'subscription');
  }, [items]);

  const deliveryFeeConfig = dynamicDeliveryFee !== null && dynamicDeliveryFee !== undefined ? dynamicDeliveryFee : 30;

  const isDeliveryFree = offerResult.isDeliveryFree;
  const deliveryFee = isDeliveryFree ? 0 : deliveryFeeConfig;
  const finalTotal = grandTotal + deliveryFee;

  const minOrderValue = deliveryConfig?.min_order_value || 150;
  const isBelowMinOrder = total < minOrderValue;

  // Per-delivery cost = single drop, no monthly multiplier baked in
  const perDeliveryCost = useMemo(() => {
    return items
      .filter(i => i.purchase_type === 'subscription')
      .reduce((s, i) => s + i.discountPrice * i.qty, 0);
  }, [items]);
  const projectedMonthlyTotal = finalTotal; // monthly total (includes multiplier from CartContext)

  const { data: walletData } = useQuery({
    queryKey: ['user-wallet-balance', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await (supabase as any).from('wallets').select('balance').eq('user_id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user
  });
  const currentBalance = (walletData as any)?.balance || 0;
  // Only block if they can't afford a SINGLE delivery drop
  const isShortfundedForFirstDelivery = currentBalance < perDeliveryCost;
  const minimumNeededToActivate = Math.max(0, perDeliveryCost - currentBalance);

  const handleUpdateSubDays = (itemId: string, newDays: number[]) => {
    updateItems(items.map(item => 
      (item.id === itemId && item.purchase_type === 'subscription') 
        ? { ...item, subscription_days: newDays } 
        : item
    ));
  };

  useEffect(() => {
    if (hasSubscriptionInCart && payment === "cod") {
      setPayment("online");
    }
  }, [hasSubscriptionInCart, payment]);

  // Reset to cart step when drawer closes
  useEffect(() => { if (!open) setTimeout(() => setStep("cart"), 300); }, [open]);

  // Address serviceability check
  useEffect(() => {
    if (!selectedAddressId) return;
    const check = async () => {
      setCheckingAddr(true);
      const { data: addr } = await (supabase as any).from("addresses").select("pincode").eq("id", selectedAddressId).maybeSingle();
      if (addr?.pincode) {
        const { data: serv } = await (supabase as any).from("serviceable_pincodes").select("pincode").eq("pincode", addr.pincode).eq("active", true).maybeSingle();
        setAddrServiceable(!!serv);
        if (!serv) toast.error("📍 Address outside delivery zone", { duration: 5000 });
      }
      setCheckingAddr(false);
    };
    check();
  }, [selectedAddressId]);

  // Auto-sync cart with live stock
  useEffect(() => {
    if (!open || !allProducts || items.length === 0) return;

    let adjustments = 0;
    const synced = items.map(i => {
      const baseId = i.id.includes('-sub-') ? i.id.split('-sub-')[0] : i.id;
      const p = allProducts.find(ap => ap.id === baseId);
      if (!p || !p.active) {
        adjustments++;
        toast.error(`${i.name} is no longer available`);
        return null;
      }
      if (p.stock_quantity <= 0) {
        adjustments++;
        toast.error(`${i.name} just went out of stock`);
        return null;
      }
      if (i.qty > p.stock_quantity) {
        adjustments++;
        toast.error(`${i.name} quantity reduced to match available stock (${p.stock_quantity})`);
        return { ...i, qty: p.stock_quantity, stock_quantity: p.stock_quantity };
      }
      // Update stock_quantity in cart item for proactive inc check
      if (i.stock_quantity !== p.stock_quantity) {
        return { ...i, stock_quantity: p.stock_quantity };
      }
      return i;
    }).filter(Boolean) as any[];

    if (adjustments > 0) {
      updateItems(synced);
    }
  }, [open, allProducts]);

  const cartSlugs = useMemo(() => items.map(i => i.slug || ""), [items]);
  const crossSells = useMemo(() => {
    return (allProducts || []).filter(p => {
      return !items.find(i => {
        const baseId = i.id.includes('-sub-') ? i.id.split('-sub-')[0] : i.id;
        return baseId === p.id;
      });
    }).slice(0, 6);
  }, [allProducts, items]);


  const applyOffer = async (offer: Offer) => {
    const isEligible = total >= (Number(offer.min_order_value) || 0);
    if (!isEligible) return;
    if (activeOffer?.id === offer.id) { setActiveOffer(null); setAppliedCoupon(null); toast.info("Offer removed"); return; }
    if (offer.offer_type === "product_discount" && offer.coupon_code_to_apply) {
      const { data } = await supabase.from("coupons").select("*").eq("code", offer.coupon_code_to_apply).eq("active", true).maybeSingle();
      if (!data) { toast.error("Coupon linked to this offer is invalid"); return; }
      setAppliedCoupon(data as unknown as Coupon);
    } else { setAppliedCoupon(null); }
    setActiveOffer(offer);
    toast.success(`"${offer.title}" applied!`);
  };

  const { data: dbSlots } = useQuery({
    queryKey: ['delivery-slots-config'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('delivery_slots') as any).select('*').eq('is_active', true).order('cutoff_time', { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    }
  });

  const availableSlotsToday = useMemo(() => {
    if (!dbSlots) return [];
    const currentLocalTimeStr = format(new Date(), "HH:mm:ss");
    return dbSlots.filter(slot => currentLocalTimeStr < slot.cutoff_time);
  }, [dbSlots]);

  const soldOut = useMemo(() => {
    return dbSlots && dbSlots.length > 0 && availableSlotsToday.length === 0;
  }, [dbSlots, availableSlotsToday]);

  const goToAddress = () => {
    if (!user) { setOpen(false); nav("/auth"); return; }
    setStep("address");
    setTimeout(() => bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
  };

  const goToSlots = () => {
    if (!selectedAddressId) { toast.error("Please select a delivery address"); return; }
    if (!addrServiceable) { toast.error("Address is outside our delivery zone"); return; }
    if (hasSubscriptionInCart) {
      setDeliveryDate(new Date());
      setSelectedSlotId("subscription"); // Dummy key for sub-only checkout
      setStep("payment");
    } else {
      setStep("slots");
    }
    setTimeout(() => bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
  };

  const goToPayment = () => {
    if (!selectedSlotId || !deliveryDate) { toast.error("Please select a delivery slot"); return; }
    setStep("payment");
    setTimeout(() => bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
  };

  const placeOrder = async () => {
    if (!user) { setOpen(false); nav("/auth"); return; }
    if (!selectedAddressId) { toast.error("Choose an address"); return; }
    if (!hasPhone) { setVerifyOpen(true); return; }
    if (payment === "cod" && hasSubscriptionInCart) {
      toast.error("Subscriptions require prepaid Online Payment (UPI / Card). COD is unavailable.");
      return;
    }
    setPlacing(true);

    const instantItems = items.filter(i => i.purchase_type === 'instant');
    const subItems = items.filter(i => i.purchase_type === 'subscription');

    if (subItems.length > 0) {
      const singleDeliveryCost = subItems.reduce((s, i) => s + i.discountPrice * i.qty, 0);
      const { data: wallet } = await (supabase as any).from('wallets').select('balance').eq('user_id', user.id).maybeSingle();
      const currentWalletBalance = (wallet as any)?.balance || 0;

      if (currentWalletBalance < singleDeliveryCost) {
        setPlacing(false);
        const difference = Math.max(0, singleDeliveryCost - currentWalletBalance);
        toast.error("Insufficient wallet balance. Redirecting to recharge...");
        setOpen(false);
        nav(`/account/wallet?redirect=/checkout&recharge=${difference}`);
        return;
      }
    }

    let onlinePaid = false;
    if (payment === "online") {
      const r = await payNow(finalTotal);
      if (!r.ok) { setPlacing(false); toast.error("Payment failed"); return; }
      onlinePaid = true;
    } else if ((payment as string) === "wallet") {
      const { error } = await (supabase as any).rpc('deduct_wallet', { uid: user.id, amount: finalTotal });
      if (error) { setPlacing(false); toast.error("Wallet deduction failed"); return; }
      onlinePaid = true;
    }

    const { data: addr } = await supabase.from("addresses").select("*").eq("id", selectedAddressId).maybeSingle();
    let mainOrderId = "";

    // 1. Process Instant Items (Standard Order)
    if (instantItems.length > 0) {
      const chosenSlot = dbSlots?.find(s => s.id === selectedSlotId);
      const chosenSlotLabel = chosenSlot?.label || "Standard Delivery";

      const { data: order, error } = await (supabase as any).from("orders").insert({
        user_id: user.id,
        address_id: selectedAddressId,
        address_snapshot: addr as any,
        subtotal: instantItems.reduce((s, i) => s + i.discountPrice * i.qty, 0),
        delivery_fee: deliveryFee,
        discount: discount, // Full discount applied to main order for simplicity
        total: finalTotal,
        payment_method: (payment === "online" ? "upi" : payment) as any,
        payment_status: payment === "cod" ? "pending" : (onlinePaid ? "paid" : "pending"),
        order_status: "placed",
        coupon_code: appliedCoupon?.code,
        slot_id: selectedSlotId,
        delivery_slot: chosenSlotLabel,
        scheduled_date: deliveryDate ? format(deliveryDate, "yyyy-MM-dd") : null,
        lat: (addr as any)?.lat ?? null,
        lng: (addr as any)?.lng ?? null,
        pincode: (addr as any)?.pincode ?? null,
      }).select().single();

      if (error || !order) { setPlacing(false); toast.error(error?.message || "Could not place order"); return; }
      mainOrderId = order.id;

      const { error: e2 } = await (supabase as any).from("order_items").insert(
        instantItems.map(i => ({ order_id: order.id, product_id: i.id, product_name: i.name, product_image: i.image, unit: i.unit, quantity: i.qty, price: i.discountPrice }))
      );
      if (e2) { setPlacing(false); toast.error(e2.message.includes("INSUFFICIENT_STOCK") ? "An item went out of stock" : e2.message); return; }
    }

    // 2. Process Subscription Items
    if (subItems.length > 0) {
      // Pre-validate that all subscription items can resolve a valid product UUID
      for (const i of subItems) {
        const product = allProducts?.find(p => p.slug === i.slug || p.name === i.slug || p.id === i.id);
        if (!product) {
          toast.error(`Could not resolve catalog product for subscription: ${i.name}. Please contact support.`);
          setPlacing(false);
          return;
        }
      }

      const { error: subErr } = await (supabase as any).from("subscriptions").insert(
        subItems.map(i => {
          const product = allProducts?.find(p => p.slug === i.slug || p.name === i.slug || p.id === i.id);
          const resolvedSlug = product?.slug || i.slug;
          const plan = activePlans?.find(p => 
            (p.product_slug === resolvedSlug || p.product_slug === i.slug) && 
            p.frequency_type === i.frequency_type
          );
          const isWeekly = i.frequency_type === 'weekly';
          return {
            user_id: user.id,
            product_slug: resolvedSlug,
            product_id: product?.id, // Assured to be valid UUID
            plan_id: plan?.id || null, // Write correct subscription plan_id
            quantity: i.qty,
            selected_days: i.subscription_days || (isWeekly ? [selectedWeeklyDay] : (plan?.frequency_type === 'alternate' ? (
              (() => {
                const cDays = plan?.custom_days || [];
                const dividerIndex = cDays.indexOf(-1);
                return dividerIndex === -1 ? (cDays.length > 0 ? cDays : [0, 2, 4]) : cDays.slice(0, dividerIndex);
              })()
            ) : [0, 1, 2, 3, 4, 5, 6])),
            address_id: selectedAddressId,
            status: 'active',
            next_delivery_date: format(new Date(Date.now() + 86400000), "yyyy-MM-dd"), // Tomorrow default
            slot_id: selectedSlotId || 'subscription',
          };
        })
      );

      if (subErr) {
        toast.error("Subscriptions failed to save: " + subErr.message);
        setPlacing(false);
        return;
      }
    }

    setPlacing(false);
    placedRef.current = true;
    clear();
    setOpen(false);
    if (mainOrderId) nav(`/order-success/${mainOrderId}`);
    else { toast.success("Subscriptions confirmed!"); nav("/account?tab=subscriptions"); }
  };

  // Step label helpers
  const stepLabel = { cart: "Your Cart", address: "Delivery Address", slots: "Delivery Time", payment: "Payment" }[step];

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md flex flex-col p-0 bg-background gap-0 h-full">

          {/* ── HEADER ── */}
          <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
            <SheetTitle className="font-display text-brown text-xl flex items-center gap-3">
              {step !== "cart" && (
                <button onClick={() => setStep(step === "payment" ? (hasSubscriptionInCart ? "address" : "slots") : step === "slots" ? "address" : "cart")} className="text-muted-foreground hover:text-brown transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <ShoppingBag className="w-5 h-5" />
              {stepLabel}
              {step === "cart" && count > 0 && <span className="text-sm text-muted-foreground font-body font-normal">({count})</span>}
            </SheetTitle>
            {/* Step progress bar */}
            {items.length > 0 && (
              <div className="flex gap-1.5 pt-2">
                {(["cart", "address", "slots", "payment"] as CheckoutStep[]).map(s => {
                  const active = (
                    (s === "cart") ||
                    (s === "address" && ["address", "slots", "payment"].includes(step)) ||
                    (s === "slots" && ["slots", "payment"].includes(step)) ||
                    (s === "payment" && step === "payment")
                  );
                  return (
                    <div key={s} className={`flex-1 h-1 rounded-full transition-all duration-500 ${active ? "bg-primary" : "bg-border"}`} />
                  );
                })}
              </div>
            )}
          </SheetHeader>

          {items.length === 0 ? (
            <div className="flex-1 grid place-items-center text-center px-6">
              <div>
                <div className="w-20 h-20 mx-auto rounded-full bg-secondary grid place-items-center mb-4">
                  <ShoppingBag className="w-8 h-8 text-brown/60" />
                </div>
                <p className="font-display font-semibold text-brown">Your cart is empty</p>
                <p className="text-sm text-muted-foreground mt-1">Add some farm-fresh eggs to get started.</p>
                <Button variant="hero" className="mt-6" onClick={() => { 
                    setOpen(false); 
                    nav("/#products");
                    setTimeout(() => {
                      document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
                    }, 100);
                  }}>Browse Products</Button>
              </div>
            </div>
          ) : (
            <>
              {/* ── SCROLLABLE BODY ── */}
              <div ref={bodyRef} className="flex-1 overflow-y-auto no-scrollbar">

                {/* ═══ STEP: CART ═══ */}
                {step === "cart" && (
                  <div className="px-4 pt-4 pb-2 space-y-6">
                    {/* Items */}
                    <div className="space-y-3">
                      {items.map(i => {
                        const daysArray = i.subscription_days || [];
                        const isAlternate = i.frequency_type === 'alternate';
                        const isWeekly = i.frequency_type === 'weekly';

                        const plan = activePlans?.find(p => p.product_slug === i.slug && p.frequency_type === i.frequency_type);
                        let optADays = [0, 2, 4];
                        let optBDays = [1, 3, 5];
                        if (isAlternate && plan) {
                          const cDays = plan.custom_days || [];
                          const dividerIndex = cDays.indexOf(-1);
                          if (dividerIndex !== -1) {
                            optADays = cDays.slice(0, dividerIndex);
                            optBDays = cDays.slice(dividerIndex + 1);
                          } else if (cDays.length > 0) {
                            optADays = cDays;
                          }
                        }

                        const getDaysLabel = (days: number[]) => {
                          const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                          return days.map(d => DAYS_SHORT[d]).join(", ");
                        };

                        const isOptionA = optADays.every(d => daysArray.includes(d)) && daysArray.length === optADays.length;
                        const isOptionB = optBDays.every(d => daysArray.includes(d)) && daysArray.length === optBDays.length;

                        return (
                          <div key={`${i.id}-${i.purchase_type}`} className="flex flex-col bg-card rounded-2xl p-3 shadow-soft border border-border/40 gap-3">
                            <div className="flex gap-3">
                              <img src={i.images?.[0] || i.image} alt={i.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="font-display font-semibold text-brown text-sm leading-tight">{i.name}</div>
                                  {i.purchase_type === 'subscription' && (
                                    <span className="bg-primary/20 text-brown text-[8px] font-bold uppercase px-1.5 py-0.5 rounded flex items-center gap-1">
                                      <Repeat className="w-2 h-2" /> Sub
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">{i.unit}</div>
                                
                                {i.purchase_type === 'subscription' && daysArray.length > 0 && (
                                  <div className="text-[10px] text-muted-foreground mt-1 font-semibold bg-secondary/50 px-2 py-0.5 rounded-md inline-block border border-border/40">
                                    Schedule: {getDaysLabel(daysArray)}
                                  </div>
                                )}

                                <div className="font-display font-bold text-brown text-sm mt-1">
                                  ₹{i.discountPrice * i.qty}
                                  {i.purchase_type === 'subscription' && <span className="text-[10px] font-normal text-muted-foreground"> / delivery</span>}
                                </div>
                              </div>
                              <div className="flex flex-col items-end justify-between shrink-0">
                                <button onClick={() => remove(i.id, i.purchase_type)} className="text-muted-foreground hover:text-destructive transition-smooth"><Trash2 className="w-4 h-4" /></button>
                                <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5">
                                  <button onClick={() => dec(i.id, i.purchase_type)} className="w-7 h-7 grid place-items-center rounded-md hover:bg-card text-brown"><Minus className="w-3.5 h-3.5" /></button>
                                  <span className="text-sm font-semibold text-brown w-5 text-center">{i.qty}</span>
                                  <button onClick={() => inc(i.id, i.purchase_type)} className="w-7 h-7 grid place-items-center rounded-md hover:bg-card text-brown"><Plus className="w-3.5 h-3.5" /></button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Offers Carousel — always rendered so it never collapses */}
                    {availableOffers === undefined ? (
                      <div className="border border-dashed border-primary/30 bg-primary/5 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Tag className="w-4 h-4 text-primary" />
                          <span className="font-display font-bold text-sm text-brown">Available Rewards</span>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-none w-52 h-20 bg-secondary/40 rounded-xl animate-pulse" />
                          <div className="flex-none w-52 h-20 bg-secondary/30 rounded-xl animate-pulse" />
                        </div>
                      </div>
                    ) : availableOffers.length > 0 ? (
                      <div className="border border-dashed border-primary/40 bg-primary/5 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Tag className="w-4 h-4 text-primary" />
                          <span className="font-display font-bold text-sm text-brown">Available Rewards</span>
                        </div>
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 snap-x snap-mandatory">
                          {availableOffers?.map(offer => {
                            const isEligible = total >= (Number(offer.min_order_value) || 0);
                            const isActive = activeOffer?.id === offer.id;
                            const Icon = OFFER_ICONS[offer.offer_type] || Tag;
                            return (
                              <div key={offer.id} className={`flex-none w-52 p-3 rounded-xl border snap-start transition-all duration-300 ${
                                isActive ? "border-success bg-success/5" : isEligible ? "border-primary/40 bg-card shadow-sm" : "opacity-55 border-dashed bg-secondary/10"
                              }`}>
                                <div className="flex justify-between items-start mb-1.5">
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${isActive ? "bg-success text-white" : "bg-primary/20 text-brown"}`}>
                                    <Icon className="w-2.5 h-2.5" />
                                    {offer.offer_type.replace("_", " ")}
                                  </span>
                                  {isEligible && (
                                    <button onClick={() => applyOffer(offer)} className={`text-[10px] font-bold uppercase ${isActive ? "text-success" : "text-primary hover:underline"}`}>
                                      {isActive ? "Applied ✓" : "Apply Deal"}
                                    </button>
                                  )}
                                </div>
                                <div className="font-display font-semibold text-brown text-xs">{offer.title}</div>
                                <div className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">{offer.description}</div>
                                {!isEligible && offer.offer_type !== "bundle_buy" && (
                                  <div className="mt-1.5 text-[9px] font-medium text-amber-600">Add ₹{Math.ceil(Number(offer.min_order_value) - total)} more</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {/* Cross-sells */}
                    {crossSells.length > 0 && !hasSubscriptionInCart && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Zap className="w-4 h-4 text-primary" />
                          <span className="font-display font-bold text-sm text-brown">You May Also Like</span>
                        </div>
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 snap-x snap-mandatory">
                          {crossSells.map(p => (
                            <div key={p.id} className="flex-none w-28 snap-start">
                              <div className="rounded-xl overflow-hidden bg-secondary/30 aspect-square mb-1.5">
                                {(p.images?.[0] || p.image_url) && <img src={p.images?.[0] || p.image_url!} alt={p.name} className="w-full h-full object-cover" />}
                              </div>
                              <div className="text-[10px] font-semibold text-brown line-clamp-1">{p.name}</div>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-[10px] font-bold text-brown">₹{p.discounted_price}</span>
                                <button
                                  onClick={() => add({ id: p.id!, name: p.name, slug: p.slug, benefit: p.benefit ?? "", description: p.description ?? null, unit: p.unit ?? "", price: Number(p.original_price), discountPrice: Number(p.discounted_price), stock_quantity: Number(p.stock_quantity), image: p.image_url || "", images: p.images || [] })}
                                  className="w-6 h-6 rounded-full bg-primary grid place-items-center hover:bg-primary/80 transition-colors"
                                >
                                  <Plus className="w-3 h-3 text-brown" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ═══ STEP: ADDRESS ═══ */}
                {step === "address" && (
                  <div className="px-4 pt-4 pb-2">
                    <p className="text-xs text-muted-foreground mb-4">Select or add a delivery address below.</p>
                    <div className="bg-card rounded-2xl border border-border/40 overflow-hidden">
                      <AddressPicker
                        showSelect
                        selectedId={selectedAddressId}
                        onSelect={(id) => { setSelectedAddressId(id); setAddrServiceable(true); setIsAddressFormOpen(false); }}
                        onFormToggle={(isOpen) => {
                          setIsAddressFormOpen(isOpen);
                          if (isOpen) setSelectedAddressId("");
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* ═══ STEP: SLOTS ═══ */}
                {step === "slots" && (
                  <div className="px-4 pt-4 pb-2 space-y-4">
                    {hasWeeklySub && (
                      <div className="bg-card rounded-2xl border border-border/40 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary" />
                          <span className="font-display font-bold text-sm text-brown">Weekly Delivery Day</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          Select the day of the week you would like your weekly subscriptions to arrive:
                        </p>
                        <div className="grid grid-cols-7 gap-1 bg-secondary/20 p-1.5 rounded-xl border border-border">
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => {
                            const isSelected = selectedWeeklyDay === idx;
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => setSelectedWeeklyDay(idx)}
                                className={`h-8 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground shadow"
                                    : "bg-card border border-border text-muted-foreground hover:bg-secondary/40"
                                }`}
                              >
                                {day[0]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {items.every(i => i.purchase_type === 'subscription') ? (
                      <div className="text-center py-10 bg-secondary/30 rounded-2xl p-6">
                        <Calendar className="w-10 h-10 text-primary mx-auto mb-3" />
                        <p className="font-display font-bold text-brown">Subscription Fulfillment</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Your subscriptions will be delivered according to their selected weekly schedules. 
                          Daily cutoff times do not apply to recurring orders.
                        </p>
                        <Button variant="hero" className="mt-6 w-full" onClick={() => {
                          setDeliveryDate(new Date()); 
                          setSelectedSlotId("subscription"); // Dummy key for sub-only checkout
                          setStep("payment");
                        }}>
                          Continue to Payment
                        </Button>
                      </div>
                    ) : (
                      <SlotPicker
                        selectedSlotId={selectedSlotId}
                        onSelect={(date, id) => { setDeliveryDate(date); setSelectedSlotId(id); }}
                      />
                    )}
                  </div>
                )}


                {/* ═══ STEP: PAYMENT ═══ */}
                {step === "payment" && (
                  <div className="px-4 pt-4 pb-2 space-y-4">
                    {/* Payment Methods */}
                    {hasSubscriptionInCart ? (
                      <div className="bg-card rounded-2xl border border-border/40 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Wallet className="w-4 h-4 text-primary" />
                          <span className="font-display font-bold text-sm text-brown">Payment Mode: Prepaid Wallet</span>
                        </div>
                        <div className="p-3 bg-secondary/20 border border-border rounded-xl">
                          <p className="text-xs text-muted-foreground">Subscriptions are automatically fulfilled using your prepaid wallet balance.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-card rounded-2xl border border-border/40 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <CreditCard className="w-4 h-4 text-primary" />
                          <span className="font-display font-bold text-sm text-brown">Payment Method</span>
                        </div>
                        <RadioGroup value={payment} onValueChange={v => setPayment(v as any)} className="space-y-2">
                          {[
                            { v: "online", label: "Pay Online (Razorpay)", desc: "Cards, UPI, Net Banking" },
                            { v: "upi", label: "UPI", desc: "Google Pay, PhonePe, Paytm" },
                            { v: "cod", label: "Cash on Delivery", desc: "Pay when your eggs arrive", disabled: hasSubscriptionInCart },
                            { v: "wallet", label: "Pay via Wallet Balance", desc: currentBalance < finalTotal ? `Insufficient wallet funds (Balance: ₹${currentBalance})` : `Deduct ₹${finalTotal} from your wallet`, disabled: currentBalance < finalTotal }
                          ].map(o => {
                            const isDisabled = o.disabled;
                            return (
                              <label 
                                key={o.v} 
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-smooth ${
                                  isDisabled 
                                    ? "opacity-40 grayscale cursor-not-allowed pointer-events-none" 
                                    : payment === o.v 
                                      ? "border-primary bg-primary/5 cursor-pointer" 
                                      : "border-border hover:border-primary/30 cursor-pointer"
                                }`}
                              >
                                <RadioGroupItem value={o.v} disabled={isDisabled} />
                                <div className="flex-1">
                                  <div className="font-semibold text-brown text-sm">{o.label}</div>
                                  <div className="text-[10px] text-muted-foreground">{o.desc}</div>
                                </div>
                                {payment === o.v && !isDisabled && <Check className="w-4 h-4 text-success shrink-0" />}
                              </label>
                            );
                          })}
                        </RadioGroup>
                      </div>
                    )}

                    {/* Bill Breakdown */}
                    <div className="bg-card rounded-2xl border border-border/40 p-4">
                      <div className="font-display font-bold text-brown text-sm mb-3">Bill Details</div>
                      <div className="space-y-2 text-xs">
                        {hasSubscriptionInCart ? (
                          <div className="flex justify-between text-muted-foreground">
                            <span>Per Delivery Cost ({items.filter(i => i.purchase_type==='subscription').reduce((s,i)=>s+i.qty,0)} items)</span>
                            <span className="font-semibold text-brown">₹{perDeliveryCost}</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between text-muted-foreground">
                              <span>Items Total ({count})</span>
                              <span>₹{total}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                              <span>Delivery</span>
                              <span className={isDeliveryFree ? "text-success font-semibold" : ""}>{isDeliveryFree ? "FREE" : `₹${deliveryFee}`}</span>
                            </div>
                          </>
                        )}
                        {discount > 0 && (
                          <div className="flex justify-between text-success font-medium">
                            <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Discount ({appliedCoupon?.code || "Offer"})</span>
                            <span>− ₹{discount}</span>
                          </div>
                        )}
                        {!hasSubscriptionInCart && (
                          <div className="flex justify-between font-display font-bold text-brown text-sm pt-2 mt-1 border-t border-border">
                            <span>Grand Total</span>
                            <span>₹{finalTotal}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom padding so content clears sticky footer */}
                <div className="h-6" />
              </div>

              {/* ── STICKY FOOTER ── */}
              <div className="shrink-0 px-4 py-4 bg-card border-t border-border shadow-[0_-8px_24px_rgba(0,0,0,0.05)]">
                {/* Mini bill summary (always visible) */}
                <div className="flex justify-between items-baseline mb-3">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {hasSubscriptionInCart ? "Per Delivery" : (step === "cart" ? "Subtotal" : "Grand Total")}
                    </div>
                    <div className="font-display font-bold text-brown text-xl">
                      {hasSubscriptionInCart ? `₹${perDeliveryCost}` : `₹${step === "cart" ? total : finalTotal}`}
                    </div>
                  </div>
                  {discount > 0 && (
                    <div className="text-right">
                      <div className="text-[9px] text-muted-foreground">You save</div>
                      <div className="text-xs font-bold text-success">₹{discount}</div>
                    </div>
                  )}
                </div>

                {/* CTA — changes per step */}
                {step === "cart" && (
                  <div className="w-full space-y-3">
                    {isBelowMinOrder && (
                      <div className="bg-red-50 text-red-700 p-3 rounded-lg font-medium text-sm border border-red-100">
                        Minimum order value for delivery is ₹{minOrderValue}. Please add ₹{minOrderValue - total} more to proceed!
                      </div>
                    )}
                    <Button variant="hero" size="lg" className="w-full h-12 font-bold shadow-yolk" onClick={goToAddress} disabled={isBelowMinOrder}>
                      Proceed to Address <ChevronRight className="w-5 h-5 ml-1" />
                    </Button>
                  </div>
                )}
                {step === "address" && !isAddressFormOpen && (
                  <Button variant="hero" size="lg" className="w-full h-12 font-bold shadow-yolk"
                    onClick={goToSlots}
                    disabled={!selectedAddressId || checkingAddr || !addrServiceable || soldOut}
                  >
                    {checkingAddr
                      ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Checking…</>
                      : !addrServiceable
                        ? "Area Not Serviceable"
                        : soldOut
                          ? "Sold Out for Today"
                          : <>Proceed to Payment <ChevronRight className="w-5 h-5 ml-1" /></>
                    }
                  </Button>
                )}
                {step === "slots" && (
                  <Button variant="hero" size="lg" className="w-full h-12 font-bold shadow-yolk"
                    onClick={goToPayment}
                    disabled={!selectedSlotId || !deliveryDate || soldOut}
                  >
                    {soldOut ? "All Shifts Closed" : <>Confirm Slot & Proceed to Pay <ChevronRight className="w-5 h-5 ml-1" /></>}
                  </Button>
                )}
                {step === "payment" && (
                  <div className="w-full space-y-3">
                    {hasSubscriptionInCart && (
                      <div>
                        {!isShortfundedForFirstDelivery ? (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-800 text-xs">
                            ✓ Sufficient balance available! ₹{perDeliveryCost} will be debited per delivery. (Current Wallet: ₹{currentBalance})
                          </div>
                        ) : (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 text-xs space-y-1">
                            <p className="font-semibold">⚠️ Minimum Balance Required</p>
                            <p>Your current wallet balance is <strong>₹{currentBalance}</strong>. A minimum of <strong>₹{perDeliveryCost}</strong> (1 delivery) is required to activate this schedule.</p>
                            <p className="text-stone-500">* Recharge any amount you prefer to cover future deliveries.</p>
                          </div>
                        )}
                      </div>
                    )}
                    {hasSubscriptionInCart && isShortfundedForFirstDelivery ? (
                      <Button variant="hero" size="lg" className="w-full h-12 font-bold shadow-yolk text-[13px] sm:text-sm !bg-amber-500 hover:!bg-amber-600 !text-white !border-amber-600"
                        onClick={() => {
                          setOpen(false);
                          nav(`/account/wallet?redirect=/checkout&recharge=${minimumNeededToActivate}`);
                        }}
                        disabled={profileLoading || !addrServiceable || checkingAddr}
                      >
                        Go to Wallet to Recharge • Min Add ₹{minimumNeededToActivate}
                      </Button>
                    ) : (
                      <Button variant="hero" size="lg" className="w-full h-12 font-bold shadow-yolk text-base"
                        onClick={placeOrder}
                        disabled={placing || !selectedAddressId || !addrServiceable}
                      >
                        {placing
                          ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Placing Order…</>
                          : hasSubscriptionInCart
                            ? <>Place Order • ₹{perDeliveryCost}</>
                            : <>Place Order • ₹{finalTotal}</>
                        }
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <JitVerifySheet
        open={verifyOpen && !hasPhone}
        missing={!hasPhone ? "phone" : null}
        blocking
        onOpenChange={setVerifyOpen}
        onComplete={async () => { await refetchProfile(); placeOrder(); }}
      />
    </>
  );
};

export default CartDrawer;
