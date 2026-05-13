import { Sprout, PackageCheck, ShieldCheck, Wheat, Sun, Truck } from "lucide-react";

const points = [
  { icon: Sprout, label: "Farm Sourced", desc: "Hand-picked from trusted partner farms." },
  { icon: Sun, label: "Fresh Morning Collection", desc: "Collected at first light, every single day." },
  { icon: Wheat, label: "Quality Feed", desc: "Vegetarian, hormone-free, naturally rich." },
  { icon: ShieldCheck, label: "Hygienic Handling", desc: "Sanitised, graded and inspected with care." },
  { icon: PackageCheck, label: "Daily Packed", desc: "Packed the same day — never warehoused." },
  { icon: Truck, label: "Delivered Fresh", desc: "At your doorstep before breakfast." },
];

const SafetyChecks = () => (
  <section className="relative py-24 lg:py-32 gradient-brown text-brown-foreground overflow-hidden">
    <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "28px 28px" }} />
    <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-primary/15 blur-3xl" />

    <div className="container relative">
      <div className="text-center max-w-3xl mx-auto mb-16 lg:mb-20">
        <div className="eyebrow text-primary mb-4">Our promise</div>
        <h2 className="display-2 text-brown-foreground mb-5">
          Freshness,<br />
          <span className="italic font-normal text-primary">handled with care.</span>
        </h2>
        <p className="lead text-brown-foreground/70">
          Carefully sourced eggs, hygienically packed and delivered fresh to your doorstep every morning.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 lg:gap-10 max-w-5xl mx-auto">
        {points.map((p) => (
          <div key={p.label} className="flex flex-col items-center text-center group">
            <div className="relative">
              <div className="absolute inset-0 gradient-yolk rounded-full blur-xl opacity-40 group-hover:opacity-70 transition-smooth" />
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full gradient-yolk grid place-items-center shadow-yolk ring-4 ring-brown z-10 group-hover:scale-110 transition-smooth">
                <p.icon className="w-9 h-9 sm:w-10 sm:h-10 text-brown" strokeWidth={1.8} />
              </div>
            </div>
            <h3 className="mt-5 font-display font-semibold text-brown-foreground text-base sm:text-lg leading-tight">{p.label}</h3>
            <p className="mt-1.5 text-xs sm:text-sm text-brown-foreground/60 leading-relaxed max-w-[18ch]">{p.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default SafetyChecks;
