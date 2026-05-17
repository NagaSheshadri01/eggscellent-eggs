import { useMemo, useState } from "react";
import { Plus, Sparkles, Check, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart, type Product } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import ProductImageModal from "./ProductImageModal";
import {
  useSubscriptionPlans,
  computeDiscountedPrice,
  FREQUENCY_META,
  type SubFrequency,
} from "@/hooks/useSubscriptionPlans";

const FREQS: SubFrequency[] = ["daily", "alternate", "weekly"];

type Props = { product: Product; index: number };

const UnifiedProductCard = ({ product, index }: Props) => {
  const { add } = useCart();
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: plans } = useSubscriptionPlans();
  const { data: activeSubs = [] } = useQuery({
    queryKey: ['active-user-contracts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('subscriptions')
        .select('id, status')
        .in('status', ['active', 'paused'])
        .eq('user_id', user.id);
      return data || [];
    },
    enabled: !!user
  });

  const hasOngoingSubscription = activeSubs.length > 0;

  const [mode, setMode] = useState<"once" | "subscribe">("once");
  const [freq, setFreq] = useState<SubFrequency>("daily");
  const [selectedAltOption, setSelectedAltOption] = useState<'A' | 'B'>('A');
  const [selectedWeeklyDay, setSelectedWeeklyDay] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  
  const [lightbox, setLightbox] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });

  const off = Math.round(((product.price - product.discountPrice) / product.price) * 100);

  const plan = useMemo(
    () => plans?.find((p: any) => p.product_slug === product.slug && p.frequency_type === freq),
    [plans, product.slug, freq],
  );
  const subPrice = computeDiscountedPrice(product.discountPrice, freq, plan);
  const perDelivery = product.discountPrice - subPrice;
  const monthly = perDelivery * FREQUENCY_META[freq].perMonth;
  
  const isSoldOut = (product.stock_quantity ?? 1) <= 0;

  const subscribe = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Determine target days array based on active selected frequency tab
    let targetDays: number[] = [1, 2, 3, 4, 5, 6, 0]; // Default for Daily
    
    if (freq === 'alternate') {
      targetDays = selectedAltOption === 'A' ? [1, 3, 5] : [2, 4, 0];
    } else if (freq === 'weekly') {
      targetDays = [selectedWeeklyDay];
    }

    const cartProduct = {
      ...product,
      name: plan?.title || product.name,
      discountPrice: subPrice,
      frequency_type: freq,
      unit: plan ? `Pack of ${plan.quantity}` : product.unit
    };

    add(cartProduct, "subscription", targetDays);
    toast.success(`Added ${product.name} subscription to cart!`);
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

        {/* Subscribe sub-controls (animated reveal) */}
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
            mode === "subscribe" ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-full bg-background/60 border border-border/60">
              {FREQS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFreq(f)}
                  className={`text-[11px] font-semibold py-1.5 rounded-full transition-smooth ${
                    freq === f ? "bg-primary text-brown shadow-yolk" : "text-brown/70 hover:text-brown"
                  }`}
                >
                  {FREQUENCY_META[f].label.split(" ")[0]}
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
                  <div className="text-[9px] mt-0.5 font-semibold leading-tight text-muted-foreground">Mon, Wed, Fri</div>
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
                  <div className="text-[9px] mt-0.5 font-semibold leading-tight text-muted-foreground">Tue, Thu, Sun</div>
                </button>
              </div>
            )}

            {freq === "weekly" && (
              <div className="mt-3 space-y-1">
                <div className="text-[9px] text-muted-foreground font-bold tracking-wider uppercase text-center">Delivery Day</div>
                <div className="flex justify-between gap-1 bg-background/50 p-1 rounded-full border border-border/50">
                  {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => {
                    const isSelected = selectedWeeklyDay === idx;
                    const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][idx];
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedWeeklyDay(idx)}
                        title={dayName}
                        className={`w-7 h-7 rounded-full text-[10px] font-bold transition-all flex items-center justify-center ${
                          isSelected
                            ? "bg-primary text-brown shadow"
                            : "bg-transparent text-muted-foreground hover:bg-secondary/40"
                        }`}
                      >
                        {day}
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
              <span className="font-display font-bold text-brown text-2xl">
                ₹{mode === "subscribe" ? subPrice : product.discountPrice}
              </span>
              {mode === "subscribe" ? (
                <span className="text-sm text-muted-foreground line-through">₹{product.discountPrice}</span>
              ) : (
                off > 0 && <span className="text-sm text-muted-foreground line-through">₹{product.price}</span>
              )}
            </div>
          </div>
          {mode === "once" ? (
            <Button
              size={isSoldOut ? "default" : "sm"} variant="hero"
              className={isSoldOut ? "h-11 rounded-full px-4" : "h-11 w-11 p-0 rounded-full shadow-yolk"}
              onClick={(e) => { e.stopPropagation(); add(product, "instant"); }}
              disabled={isSoldOut}
              aria-label={`Add ${product.name}`}
            >
              {isSoldOut ? "Out of Stock" : <Plus className="w-5 h-5" />}
            </Button>
          ) : hasOngoingSubscription ? (
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
