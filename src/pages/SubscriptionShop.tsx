import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/context/CartContext";
import { useProducts } from "@/hooks/useProducts";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import Header from "@/components/site/Header";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Sparkles, Calendar, ArrowRight, Loader2, ShieldCheck, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type SubscriptionPlan = {
  id: string;
  title: string;
  description: string | null;
  product_slug: string;
  quantity: number;
  frequency_type: "daily" | "alternate" | "weekly" | "custom_days";
  custom_days: number[];
  price_per_delivery: number;
  is_active: boolean;
};

const SubscriptionShop = () => {
  const { add } = useCart();
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: products = [], isLoading: productsLoading } = useProducts({ onlyActive: true });

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

  const { data: plans = [], isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["active-subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return (data || []) as SubscriptionPlan[];
    },
  });

  const handleSubscribe = (plan: SubscriptionPlan) => {
    // Find matching product in catalog
    const product = products.find(p => p.slug === plan.product_slug);
    const cartProduct = product
      ? {
          id: product.id!,
          name: plan.title, // Use plan title for clarity
          price: product.original_price,
          discountPrice: plan.price_per_delivery,
          image: product.image_url || "/placeholder.png",
          slug: product.slug,
          unit: `Pack of ${plan.quantity}`,
          frequency_type: plan.frequency_type
        }
      : {
          id: plan.id,
          name: plan.title,
          price: plan.price_per_delivery,
          discountPrice: plan.price_per_delivery,
          image: "/placeholder.png",
          slug: plan.product_slug,
          unit: `Pack of ${plan.quantity}`,
          frequency_type: plan.frequency_type
        };

    const days = plan.frequency_type === 'weekly' 
      ? [1] 
      : plan.frequency_type === 'alternate' 
        ? [1, 3, 5, 0] 
        : [1, 2, 3, 4, 5, 6, 0];
    add(cartProduct as any, 'subscription', days);
    toast.success(`Added "${plan.title}" subscription to cart!`);
  };

  const loading = plansLoading || productsLoading;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Seo 
        title="Subscribe & Save — Eggscellent" 
        description="Structured morning subscription packages freshly delivered to your door step." 
      />
      <Header />

      {/* Hero Banner */}
      <section className="relative overflow-hidden py-16 sm:py-24 bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="container max-w-6xl mx-auto px-4 text-center relative z-10 space-y-4">
          <Badge variant="secondary" className="px-3 py-1 text-xs font-bold bg-primary/20 text-brown border-none gap-1.5 self-center">
            <Sparkles className="w-3.5 h-3.5 text-primary-foreground fill-primary-foreground animate-pulse" /> 
            Premium Subscriptions
          </Badge>
          <h1 className="font-display font-black text-brown text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-none">
            Your Daily Dose of Freshness, <br />
            <span className="text-primary-foreground bg-primary px-3 rounded-2xl inline-block mt-2">Automated.</span>
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
            Choose a recurring package to lock in top discounts and get fresh, locally farmed eggs delivered early morning directly to your doorstep.
          </p>
        </div>
      </section>

      {/* Main Grid */}
      <main className="container max-w-6xl mx-auto px-4 mt-8">
        {loading ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm font-semibold text-muted-foreground">Loading active plans catalog…</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border/80 flex flex-col items-center">
            <Calendar className="w-12 h-12 text-muted-foreground opacity-50 mb-3" />
            <p className="font-display font-bold text-brown text-lg">No subscription plans live yet</p>
            <p className="text-xs text-muted-foreground max-w-xs mt-1">
              Check back soon! Our team is putting together bespoke nutritional packages for you.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const product = products.find(p => p.slug === plan.product_slug);
              return (
                <article 
                  key={plan.id}
                  className="bg-card rounded-3xl border border-border/60 overflow-hidden shadow-soft hover:shadow-card hover:-translate-y-1 transition-all flex flex-col h-full group"
                >
                  {/* Plan Top Section */}
                  <div className="relative aspect-[16/10] overflow-hidden bg-secondary/30">
                    <img 
                      src={product?.image_url || "/placeholder.png"} 
                      alt={plan.title}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                    
                    <span className="absolute top-4 left-4 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brown text-primary text-[10px] font-bold tracking-wider uppercase shadow-md">
                      <Sparkles className="w-3 h-3" /> Subscribe & Save
                    </span>

                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <p className="text-[10px] text-primary font-bold uppercase tracking-widest">
                        Pack of {plan.quantity}
                      </p>
                      <h3 className="font-display font-bold text-lg leading-tight mt-0.5">
                        {plan.title}
                      </h3>
                    </div>
                  </div>

                  {/* Plan Details */}
                  <div className="p-6 flex flex-col flex-1 space-y-4">
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {plan.description || "Freshly sourced organic farm-rich eggs. Delivered straight to you on schedule."}
                    </p>

                    {/* Meta stats */}
                    <div className="bg-secondary/40 rounded-2xl p-3 flex justify-between gap-2 border border-border/30 text-xs">
                      <div>
                        <span className="block text-[10px] text-muted-foreground uppercase font-bold">Frequency</span>
                        <span className="font-bold text-brown capitalize">{plan.frequency_type.replace(/_/g, " ")}</span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] text-muted-foreground uppercase font-bold">Standard Unit</span>
                        <span className="font-bold text-brown">{product?.unit || "Eggs Pack"}</span>
                      </div>
                    </div>

                    {/* Bottom row: Price & Subscribe CTA */}
                    <div className="flex items-center justify-between pt-4 border-t border-border/50 mt-auto">
                      <div>
                        <span className="block text-[9px] text-muted-foreground uppercase font-bold">Special Rate</span>
                        <span className="font-display font-extrabold text-brown text-2xl">
                          ₹{plan.price_per_delivery}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-0.5">/delivery</span>
                      </div>

                      {hasOngoingSubscription ? (
                        <Button 
                          className="bg-slate-800 text-white hover:bg-slate-900 font-bold rounded-2xl px-5 transition-colors"
                          onClick={() => nav("/account?tab=subscriptions")}
                        >
                          ⚙️ Manage Plan
                        </Button>
                      ) : (
                        <Button 
                          variant="hero" 
                          className="rounded-2xl px-5 font-bold shadow-yolk"
                          onClick={() => handleSubscribe(plan)}
                        >
                          Subscribe <ArrowRight className="w-4 h-4 ml-1.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Security assurances */}
      <section className="container max-w-4xl mx-auto px-4 mt-16 text-center border-t border-border/40 pt-10">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 justify-center">
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-10 h-10 rounded-full bg-green-50 border border-green-100 flex items-center justify-center text-green-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="font-bold text-xs text-brown">Prepaid Delivery Security</span>
            <span className="text-[10px] text-muted-foreground leading-tight">Secured automated morning routing</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="font-bold text-xs text-brown">Pause / Cancel Anytime</span>
            <span className="text-[10px] text-muted-foreground leading-tight">No contracts. Full self-service pause</span>
          </div>
          <div className="col-span-2 md:col-span-1 flex flex-col items-center gap-1.5">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary-foreground">
              <Heart className="w-5 h-5 fill-primary text-primary" />
            </div>
            <span className="font-bold text-xs text-brown">Nutritional Consistency</span>
            <span className="text-[10px] text-muted-foreground leading-tight">Guaranteed fresh eggs weekly</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SubscriptionShop;
