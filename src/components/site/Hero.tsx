import { Button } from "@/components/ui/button";
import hero from "@/assets/hero-eggs.jpg";
import { Truck, Leaf, Star } from "lucide-react";
import { useSiteSection } from "@/hooks/useSiteContent";

const Hero = () => {
  const scroll = () => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
  const c = useSiteSection("hero", {
    eyebrow: "100% Natural • FSSAI Certified",
    headline_top: "Farm-fresh eggs,",
    headline_accent: "delivered",
    headline_end: "with care.",
    subhead: "Hormone-free, naturally fed and hand-graded. From happy hens to your kitchen — within 24 hours of laying.",
    cta_label: "Order Fresh Today",
    delivery_note: "Free delivery above ₹199",
    image_url: "",
  });
  const heroImg = c.image_url || hero;
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 gradient-hero -z-10" />
      <div className="absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full gradient-yolk opacity-20 blur-3xl -z-10" />
      <div className="absolute -bottom-40 -left-40 w-[460px] h-[460px] rounded-full bg-accent/10 blur-3xl -z-10" />

      <div className="container grid lg:grid-cols-12 gap-10 lg:gap-16 items-center pt-12 pb-20 lg:pt-20 lg:pb-32">
        <div className="lg:col-span-6 space-y-8 animate-rise">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-xs font-semibold text-brown shadow-soft">
            <Leaf className="w-3.5 h-3.5 text-accent" />
            <span className="tracking-wide">{c.eyebrow}</span>
          </div>

          <h1 className="display-1 text-brown">
            {c.headline_top}<br />
            <span className="italic font-normal text-accent/90">{c.headline_accent}</span> with{" "}
            <span className="relative inline-block">
              <span className="relative z-10">{c.headline_end}</span>
              <span className="absolute inset-x-0 bottom-1 h-3 bg-primary/40 -z-0 rounded-sm" />
            </span>
          </h1>

          <p className="lead max-w-xl">
            {c.subhead}
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button variant="hero" size="xl" onClick={scroll} className="group">
              {c.cta_label}
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Button>
            <div className="flex items-center gap-2.5 text-sm text-brown/80">
              <Truck className="w-5 h-5 text-accent" />
              <span className="font-medium">{c.delivery_note}</span>
            </div>
          </div>

          <div className="flex items-center gap-5 pt-4 border-t border-border/60">
            <div className="flex -space-x-2">
              {[0,1,2,3].map(i => (
                <div key={i} className="w-9 h-9 rounded-full border-2 border-background shadow-soft"
                  style={{ background: `linear-gradient(135deg, hsl(${30 + i*15} 70% 75%), hsl(${20 + i*10} 50% 55%))` }} />
              ))}
            </div>
            <div className="text-sm">
              <div className="flex items-center gap-1 text-primary">
                {[0,1,2,3,4].map(i => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
                <span className="ml-1 font-semibold text-brown">4.9</span>
              </div>
              <div className="text-xs text-muted-foreground">from 12,400+ families</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 relative animate-scale-in">
          <div className="absolute inset-8 gradient-yolk rounded-full blur-3xl opacity-25 -z-10" />

          {/* Decorative ring */}
          <div className="absolute -inset-2 rounded-[2.5rem] border border-primary/20 -z-10" />

          <div className="relative rounded-[2rem] overflow-hidden shadow-card">
            <img
              src={heroImg}
              alt="Farm fresh organic brown eggs in a wooden tray"
              width={1280}
              height={1280}
              className="w-full h-[380px] sm:h-[520px] lg:h-[600px] object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brown/30 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Floating delivery badge */}
          <div className="absolute -bottom-5 -left-3 sm:left-6 glass rounded-2xl shadow-card p-4 flex items-center gap-3 animate-float">
            <div className="w-11 h-11 rounded-full bg-success/15 grid place-items-center">
              <span className="text-success text-xl">✓</span>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Delivered today</div>
              <div className="font-display font-semibold text-brown text-base">12,400+ trays</div>
            </div>
          </div>

          {/* Floating freshness badge */}
          <div className="absolute -top-4 -right-2 sm:-right-6 glass rounded-2xl shadow-card px-4 py-3 hidden sm:flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Laid</div>
              <div className="font-display font-semibold text-brown text-sm">{`< 24h ago`}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
