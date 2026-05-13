import { useMemo, useState } from "react";
import { Plus, Sparkles, Check, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart, type Product } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
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
  const [mode, setMode] = useState<"once" | "subscribe">("once");
  const [freq, setFreq] = useState<SubFrequency>("daily");
  const [busy, setBusy] = useState(false);

  const off = Math.round(((product.price - product.discountPrice) / product.price) * 100);

  const plan = useMemo(
    () => plans?.find((p) => p.product_id === product.id && p.frequency === freq),
    [plans, product.id, freq],
  );
  const subPrice = computeDiscountedPrice(product.discountPrice, freq, plan);
  const perDelivery = product.discountPrice - subPrice;
  const monthly = perDelivery * FREQUENCY_META[freq].perMonth;

  const subscribe = async () => {
    if (!user) { nav(`/auth?next=${encodeURIComponent("/")}`); return; }
    setBusy(true);
    try {
      const { data: addr } = await supabase
        .from("addresses").select("id").eq("user_id", user.id)
        .order("is_default", { ascending: false }).limit(1).maybeSingle();
      if (!addr) {
        setBusy(false);
        toast.message("Add a delivery address to start your subscription", {
          description: "We'll take you to your profile to add one.",
        });
        nav("/profile?addAddress=1");
        return;
      }
      const { data: slot } = await supabase
        .from("delivery_slots").select("id").eq("active", true)
        .order("display_order").limit(1).maybeSingle();
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("subscriptions").insert({
        user_id: user.id,
        product_id: product.id,
        plan_id: plan?.id ?? null,
        frequency: freq,
        quantity: plan?.default_quantity ?? 1,
        start_date: today,
        next_delivery_date: today,
        address_id: addr?.id ?? null,
        slot_id: slot?.id ?? null,
        status: "active",
        payment_method: "cod",
      });
      if (error) throw error;
      toast.success(`Subscribed — ${FREQUENCY_META[freq].label.toLowerCase()} ${product.name}`);
    } catch (e: any) {
      toast.error(e.message || "Could not subscribe");
    } finally { setBusy(false); }
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
      <div className="relative aspect-square overflow-hidden bg-secondary/40">
        <div className="absolute inset-0 gradient-yolk-soft opacity-0 group-hover:opacity-100 transition-smooth" />
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          width={800}
          height={800}
          className="w-full h-full object-cover group-hover:scale-110 transition-smooth duration-700"
        />
        {off > 0 && mode === "once" && (
          <span className="absolute top-4 left-4 bg-brown text-primary text-[11px] font-bold px-2.5 py-1.5 rounded-full tracking-wide shadow-soft">
            {off}% OFF
          </span>
        )}
        {mode === "subscribe" && (
          <span className="absolute top-4 right-4 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brown text-primary text-[10px] font-bold tracking-wide shadow-soft">
            <Sparkles className="w-3 h-3" /> SUBSCRIBE & SAVE
          </span>
        )}
      </div>

      <div className="p-6 flex flex-col flex-1">
        <h3 className="font-display font-semibold text-brown text-xl leading-tight line-clamp-1">{product.name}</h3>
        <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 min-h-[2.5rem]">
          {product.unit}{product.benefit ? ` • ${product.benefit}` : ""}
        </p>

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
            {monthly > 0 && (
              <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-success bg-success/10 px-3 py-2 rounded-xl">
                <Check className="w-3.5 h-3.5" /> Save ₹{monthly} / month vs one-time
              </div>
            )}
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
              size="sm" variant="hero"
              className="h-11 w-11 p-0 rounded-full shadow-yolk"
              onClick={() => add(product)}
              aria-label={`Add ${product.name}`}
            >
              <Plus className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              size="sm" variant="hero"
              className="h-11 rounded-full px-5"
              onClick={subscribe}
              disabled={busy}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {busy ? "…" : "Subscribe"}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
};

export default UnifiedProductCard;
