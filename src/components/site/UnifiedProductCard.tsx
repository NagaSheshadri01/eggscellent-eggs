import { useMemo, useState, useEffect } from "react";
import { Plus, Sparkles, Check, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart, type Product } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ProductImageModal from "./ProductImageModal";
import { useWallet } from "@/hooks/useWallet";
import {
  FREQUENCY_META,
  type SubFrequency,
} from "@/hooks/useSubscriptionPlans";

const FREQS: SubFrequency[] = ["daily", "alternate", "weekly"];

type Props = { product: Product; index: number };

const UnifiedProductCard = ({ product, index }: Props) => {
  const { add, setOpen } = useCart();
  const nav = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: wallet } = useWallet();

  const { data: activeSubs = [], refetch: refetchActiveSubs } = useQuery({
    queryKey: ['active-user-contracts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Fetch subscriptions
      const { data: subsData, error: subsError } = await (supabase as any)
        .from('subscriptions')
        .select('id, product_slug, status, quantity, selected_days')
        .in('status', ['active', 'paused'])
        .eq('user_id', user.id);

      if (subsError) throw subsError;
      if (!subsData || subsData.length === 0) return [];

      // Fetch products to map parent_group_id
      const { data: prodsData } = await (supabase as any)
        .from('products')
        .select('slug, parent_group_id, name');

      return subsData.map((sub: any) => {
        const matchingProduct = prodsData?.find((p: any) => p.slug === sub.product_slug);
        return {
          ...sub,
          parent_group_id: matchingProduct?.parent_group_id || null,
          product_name: matchingProduct?.name || sub.product_slug
        };
      });
    },
    enabled: !!user
  });

  // Query parent_group_id for this product
  const { data: productDbInfo } = useQuery({
    queryKey: ['product-db-info', product.slug],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('products')
        .select('parent_group_id')
        .eq('slug', product.slug)
        .maybeSingle();
      return data || null;
    }
  });

  const parentGroupId = productDbInfo?.parent_group_id || null;
  const hasOngoingSubscriptionForProduct = activeSubs.some((s: any) => s.product_slug === product.slug);

  // Fetch active subscription plans from the DB for this product
  const { data: plans = [] } = useQuery({
    queryKey: ["product-subscription-plans", product.slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("product_slug", product.slug)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    }
  });

  const availableFreqs = useMemo(() => {
    const fetched = plans.map(p => p.frequency_type as SubFrequency);
    return (["daily", "alternate", "weekly"] as SubFrequency[]).filter(f => fetched.includes(f));
  }, [plans]);

  const [mode, setMode] = useState<"once" | "subscribe">("once");
  const [freq, setFreq] = useState<SubFrequency>("daily");

  // Keep freq in sync with available frequencies once loaded
  useEffect(() => {
    if (availableFreqs.length > 0 && !availableFreqs.includes(freq)) {
      setFreq(availableFreqs[0]);
    }
  }, [availableFreqs, freq]);

  // Keep mode forced to "once" if no subscription plans are active
  useEffect(() => {
    if (availableFreqs.length === 0 && mode === "subscribe") {
      setMode("once");
    }
  }, [availableFreqs, mode]);

  const [busy, setBusy] = useState(false);

  const [overlapModal, setOverlapModal] = useState<{
    open: boolean;
    existingSubName: string;
    targetDaysArray: number[];
  }>({ open: false, existingSubName: "", targetDaysArray: [] });

  const [rechargeModal, setRechargeModal] = useState<{
    open: boolean;
    currentBalance: number;
  }>({ open: false, currentBalance: 0 });
  
  const [lightbox, setLightbox] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });

  const off = Math.round(((product.price - product.discountPrice) / product.price) * 100);

  const activePlan = plans.find(p => p.frequency_type === freq);
  const subPrice = activePlan ? Number(activePlan.price_per_delivery) : product.discountPrice;
  // Calculate savings vs one-time sale price
  const perDelivery = Math.max(0, product.discountPrice - subPrice);
  const monthly = perDelivery * FREQUENCY_META[freq].perMonth;
  
  const isSoldOut = (product.stock_quantity ?? 1) <= 0;

  const [selectedAltOption, setSelectedAltOption] = useState<'A' | 'B'>('A');
  const [selectedWeeklyDay, setSelectedWeeklyDay] = useState<number>(1); // Default to Monday [1]

  const executeSubscriptionTemplate = async (selectedDaysArray: number[]) => {
    // Add to cart instead of direct DB insert
    add({
      ...product,
      id: `${product.id}-sub-${freq}`,
      name: product.name,
      price: product.price,
      discountPrice: subPrice,
      frequency_type: freq,
      slug: product.slug
    }, 'subscription', selectedDaysArray);
    
    setOpen(true);
  };

  const subscribe = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!user) {
      toast.error("Please sign in to subscribe.");
      nav("/auth");
      return;
    }
    
    // Determine target days array based on active selected frequency tab
    let targetDaysArray: number[] = [0, 1, 2, 3, 4, 5, 6]; // Default for Daily
    
    if (freq === 'alternate') {
      targetDaysArray = selectedAltOption === 'A' ? [0, 2, 4] : [1, 3, 5];
    } else if (freq === 'weekly') {
      targetDaysArray = [selectedWeeklyDay];
    }

    // Step A: (Cart checkout handles wallet/payment)

    // Step B: Hard-Block Identical Duplicates
    const duplicateSub = activeSubs.find((s: any) => s.product_slug === product.slug);
    if (duplicateSub) {
      toast.error("You already have an active subscription for this product. Please manage or upgrade your existing plan in your Account Dashboard.", {
        duration: 5000
      });
      return;
    }

    // Step C: Soft-Warn Category Group Overlaps
    if (parentGroupId) {
      const familyOverlap = activeSubs.find((s: any) => s.parent_group_id === parentGroupId && s.product_slug !== product.slug);
      if (familyOverlap) {
        setOverlapModal({
          open: true,
          existingSubName: familyOverlap.product_name,
          targetDaysArray
        });
        return;
      }
    }

    await executeSubscriptionTemplate(targetDaysArray);
  };

  return (
    <article
      className={`group relative rounded-3xl overflow-hidden shadow-soft hover:shadow-card transition-smooth animate-rise flex flex-col h-full border hover:-translate-y-1 ${
        mode === "subscribe"
          ? "border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card"
          : "gradient-card border-border/60 hover:border-primary/40"
      }`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="relative aspect-square overflow-hidden bg-secondary/40 group/carousel">
        <div className="absolute inset-0 gradient-yolk-soft opacity-0 group-hover:opacity-100 transition-smooth z-10 pointer-events-none" />
        
        {/* Image Carousel */}
        <div className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide" id={`carousel-${product.id}`}>
          {(product.images?.length ? product.images : [product.image]).map((img, i) => (
            <div key={i} className="flex-none w-full h-full snap-center">
              <img
                src={img}
                alt={`${product.name} ${i + 1}`}
                loading="lazy"
                width={800}
                height={800}
                onClick={() => setLightbox({ open: true, index: i })}
                className={`w-full h-full object-cover transition-smooth duration-700 cursor-zoom-in hover:opacity-95 ${isSoldOut ? 'grayscale opacity-70' : 'group-hover:scale-105'}`}
              />
            </div>
          ))}
        </div>

        {/* Carousel Controls (only if multiple images) */}
        {(product.images?.length || 0) > 1 && (
          <>
            <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5 z-20 pointer-events-none">
              {(product.images || []).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/40 shadow-sm transition-all group-hover:bg-white/60" />
              ))}
            </div>
            <div className="absolute inset-y-0 left-0 flex items-center p-2 z-20 opacity-0 group-hover/carousel:opacity-100 transition-opacity">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const el = document.getElementById(`carousel-${product.id}`);
                  if (el) el.scrollBy({ left: -el.clientWidth, behavior: 'smooth' });
                }}
                className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm grid place-items-center text-brown shadow-sm hover:bg-white transition-colors"
              >
                ←
              </button>
            </div>
            <div className="absolute inset-y-0 right-0 flex items-center p-2 z-20 opacity-0 group-hover/carousel:opacity-100 transition-opacity">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const el = document.getElementById(`carousel-${product.id}`);
                  if (el) el.scrollBy({ left: el.clientWidth, behavior: 'smooth' });
                }}
                className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm grid place-items-center text-brown shadow-sm hover:bg-white transition-colors"
              >
                →
              </button>
            </div>
          </>
        )}

        {isSoldOut && (
          <div className="absolute inset-0 bg-background/20 backdrop-blur-[2px] z-20 grid place-items-center pointer-events-none">
            <span className="bg-background/90 text-foreground font-bold px-4 py-2 rounded-full tracking-wider text-sm shadow-sm border border-border/50">
              SOLD OUT
            </span>
          </div>
        )}
        {off > 0 && mode === "once" && !isSoldOut && (
          <span className="absolute top-4 left-4 bg-brown text-primary text-[11px] font-bold px-2.5 py-1.5 rounded-full tracking-wide shadow-soft z-30">
            {off}% OFF
          </span>
        )}
        {mode === "subscribe" && (
          <span className="absolute top-4 right-4 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brown text-primary text-[10px] font-bold tracking-wide shadow-soft z-30">
            <Sparkles className="w-3 h-3" /> SUBSCRIBE & SAVE
          </span>
        )}
      </div>

      <div className="p-6 flex flex-col flex-1">
        <h3 className="font-display font-semibold text-brown text-xl leading-tight line-clamp-1">{product.name}</h3>
        <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 min-h-[2.5rem]">
          {product.unit}{product.benefit ? ` • ${product.benefit}` : ""}
        </p>
        {product.description && (
          <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">{product.description}</p>
        )}

        {/* Mode toggle */}
        {availableFreqs.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-1 p-1 rounded-full bg-secondary/60">
            {(["once","subscribe"] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`text-[11px] font-semibold py-1.5 rounded-full transition-smooth ${
                  mode === m ? "bg-brown text-primary shadow-yolk" : "text-brown/70 hover:text-brown"
                }`}
              >
                {m === "once" ? "One-time" : "Subscribe & Save"}
              </button>
            ))}
          </div>
        )}

        {/* Subscribe sub-controls (animated reveal) */}
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
            mode === "subscribe" ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div 
              className="grid gap-1.5 p-1 rounded-full bg-background/60 border border-border/60"
              style={{ gridTemplateColumns: `repeat(${availableFreqs.length}, minmax(0, 1fr))` }}
            >
              {availableFreqs.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFreq(f)}
                  className={`text-[11px] font-semibold py-1.5 rounded-full transition-smooth ${
                    freq === f ? "bg-primary text-brown shadow-yolk" : "text-brown/70 hover:text-brown"
                  }`}
                >
                  {FREQUENCY_META[f]?.label.split(" ")[0]}
                </button>
              ))}
            </div>

            {freq === "alternate" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAltOption("A")}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    selectedAltOption === "A"
                      ? "border-primary bg-primary/15 text-brown shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:bg-secondary/40"
                  }`}
                >
                  <div className="text-[10px] font-bold">Option A</div>
                  <div className="text-[9px] mt-0.5 font-semibold leading-tight text-muted-foreground">Sun, Tue, Thu</div>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAltOption("B")}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    selectedAltOption === "B"
                      ? "border-primary bg-primary/15 text-brown shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:bg-secondary/40"
                  }`}
                >
                  <div className="text-[10px] font-bold">Option B</div>
                  <div className="text-[9px] mt-0.5 font-semibold leading-tight text-muted-foreground">Mon, Wed, Fri</div>
                </button>
              </div>
            )}

            {freq === "weekly" && (
              <div className="mt-3">
                <div className="text-[10px] font-bold text-brown uppercase tracking-wider mb-2 pl-1">
                  Select Delivery Day
                </div>
                <div className="flex justify-between bg-background/60 border border-border/60 p-1.5 rounded-2xl">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName, idx) => {
                    const isSelected = selectedWeeklyDay === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedWeeklyDay(idx)}
                        className={`w-8 h-8 rounded-full text-[11px] font-extrabold transition-smooth flex items-center justify-center ${
                          isSelected
                            ? "bg-primary text-brown shadow-yolk scale-105"
                            : "text-brown/70 hover:bg-secondary/40"
                        }`}
                      >
                        {dayName[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {monthly > 0 && (
              <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-success bg-success/10 px-3 py-2 rounded-xl">
                <Check className="w-3.5 h-3.5" /> Save ₹{monthly} / month vs one-time
              </div>
            )}
            <div className="mt-2 flex justify-center text-[11px] font-semibold text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full border border-border/50">
              Delivery: Early Morning (Freshly Delivered)
            </div>
          </div>
        </div>

        {/* Price + CTA */}
        <div className="flex items-end justify-between mt-auto pt-5">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">
              {mode === "subscribe" ? "Per delivery" : "From"}
            </div>
            <div className="flex items-baseline gap-2">
              {mode === "once" ? (
                <>
                  {product.price > product.discountPrice && (
                    <span className="text-sm text-muted-foreground line-through">₹{product.price}</span>
                  )}
                  <span className="font-display font-bold text-brown text-2xl">
                    ₹{product.discountPrice}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-sm text-muted-foreground line-through">₹{product.discountPrice}</span>
                  <span className="font-display font-bold text-brown text-2xl">
                    ₹{subPrice}
                  </span>
                </>
              )}
            </div>
          </div>
          {mode === "once" ? (
            <Button
              size={isSoldOut ? "default" : "sm"} variant="hero"
              className={isSoldOut ? "h-11 rounded-full px-4" : "h-11 w-11 p-0 rounded-full shadow-yolk"}
              onClick={(e) => { e.stopPropagation(); add({ ...product, discountPrice: product.price }, "instant"); }}
              disabled={isSoldOut}
              aria-label={`Add ${product.name}`}
            >
              {isSoldOut ? "Out of Stock" : <Plus className="w-5 h-5" />}
            </Button>
          ) : hasOngoingSubscriptionForProduct ? (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                nav("/account?tab=subscriptions");
              }}
              className="bg-slate-800 text-white font-bold h-11 rounded-full px-5 hover:bg-slate-900 transition-colors shrink-0 text-xs sm:text-sm"
            >
              ⚙️ Manage Current Ongoing Plan
            </Button>
          ) : (
            <Button
              size="sm" variant="hero"
              className="h-11 rounded-full px-5"
              onClick={subscribe}
              disabled={busy || isSoldOut}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (!isSoldOut && <Sparkles className="w-4 h-4" />)}
              {busy ? "…" : (isSoldOut ? "Out of Stock" : "Subscribe")}
            </Button>
          )}
        </div>
      </div>

      {overlapModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-sm w-full shadow-card animate-scale-in text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 grid place-items-center mx-auto text-xl">
              ⚠️
            </div>
            <h4 className="font-display font-bold text-lg text-brown leading-tight">Category Group Overlap</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Notice: You already have an active subscription for <span className="font-semibold text-brown">{overlapModal.existingSubName}</span> in this category.
            </p>
            <p className="text-xs font-semibold text-brown/90 leading-relaxed">
              Do you want to establish this parallel subscription as a separate recurring delivery line?
            </p>
            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                className="flex-1 rounded-xl text-xs font-bold border border-border"
                onClick={() => setOverlapModal({ open: false, existingSubName: "", targetDaysArray: [] })}
              >
                No, cancel
              </Button>
              <Button
                variant="hero"
                className="flex-1 rounded-xl text-xs font-bold shadow-yolk"
                onClick={() => {
                  setOverlapModal({ open: false, existingSubName: "", targetDaysArray: [] });
                  executeSubscriptionTemplate(overlapModal.targetDaysArray);
                }}
              >
                Yes, establish
              </Button>
            </div>
          </div>
        </div>
      )}

      {rechargeModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-sm w-full shadow-card animate-scale-in text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 grid place-items-center mx-auto text-xl">
              👛
            </div>
            <h4 className="font-display font-bold text-lg text-brown leading-tight">Prepaid Balance Top-Up Required</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              To activate a recurring morning delivery schedule, your wallet requires a minimum balance of <span className="font-semibold text-brown">₹200.00</span> to secure warehouse packing manifests.
            </p>
            <p className="text-xs font-semibold text-rose-600 leading-relaxed bg-rose-50/50 p-2.5 rounded-xl border border-rose-100/50">
              Your current balance is ₹{rechargeModal.currentBalance.toFixed(2)}.
            </p>
            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                className="flex-1 rounded-xl text-xs font-bold border border-border"
                onClick={() => setRechargeModal({ open: false, currentBalance: 0 })}
              >
                Cancel
              </Button>
              <Button
                variant="hero"
                className="flex-1 rounded-xl text-xs font-bold shadow-yolk"
                onClick={() => {
                  setRechargeModal({ open: false, currentBalance: 0 });
                  nav("/account?tab=wallet");
                }}
              >
                Top Up Wallet
              </Button>
            </div>
          </div>
        </div>
      )}

      <ProductImageModal 
        open={lightbox.open}
        initialIndex={lightbox.index}
        images={product.images?.length ? product.images : [product.image]}
        onClose={() => setLightbox({ ...lightbox, open: false })}
      />
    </article>
  );
};

export default UnifiedProductCard;
