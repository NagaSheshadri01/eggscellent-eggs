import { Heart, Brain, Dumbbell, Sparkles } from "lucide-react";

const items = [
  { icon: Dumbbell, title: "Complete Protein", desc: "6 g of bio-available protein per egg — every essential amino acid your body can't make on its own." },
  { icon: Brain, title: "Brain & Vision", desc: "Naturally rich in choline, lutein and zeaxanthin — nutrients linked to memory, focus and long-term eye health." },
  { icon: Sparkles, title: "Daily Immunity", desc: "A quiet powerhouse of Vitamin D, B12, selenium and zinc — the everyday defenders." },
  { icon: Heart, title: "Heart-Smart Fats", desc: "Omega-3 enriched yolks with zero antibiotics, hormones or chemical residue — clean fuel for a strong heart." },
];

const Benefits = () => (
  <section className="relative py-24 lg:py-32">
    <div className="container">
      <div className="text-center max-w-2xl mx-auto mb-16 lg:mb-20">
        <div className="eyebrow mb-4">Inside every shell</div>
        <h2 className="display-2 text-brown">Nature's multivitamin,<br/><span className="italic font-normal text-accent">in a single, perfect shell.</span></h2>
        <p className="lead mt-5">Quietly nutrient-dense. Honestly sourced. Designed for everyday wellbeing — without the noise of a supplement aisle.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
        {items.map(({ icon: Icon, title, desc }, idx) => (
          <div
            key={title}
            className="group relative gradient-card rounded-3xl p-8 shadow-soft hover:shadow-card hover:-translate-y-1 transition-smooth border border-border/60 animate-rise"
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            <div className="absolute top-0 right-0 w-24 h-24 gradient-yolk-soft rounded-bl-full opacity-50 group-hover:opacity-100 transition-smooth" />
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl gradient-yolk grid place-items-center mb-6 shadow-yolk group-hover:rotate-6 transition-smooth">
                <Icon className="w-7 h-7 text-brown" strokeWidth={2} />
              </div>
              <h3 className="font-display font-semibold text-brown text-xl mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Benefits;
