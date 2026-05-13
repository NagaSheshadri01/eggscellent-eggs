const diet = [
  { emoji: "🌽", name: "Corn", note: "Energy" },
  { emoji: "🫘", name: "Soya", note: "Protein" },
  { emoji: "🌱", name: "Flax Seeds", note: "Omega-3" },
  { emoji: "🌾", name: "Organic Grains", note: "Fibre" },
];

const HenDiet = () => (
  <section className="relative py-24 lg:py-32 gradient-warm overflow-hidden">
    <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
    <div className="container grid lg:grid-cols-12 gap-12 lg:gap-20 items-center relative">
      <div className="lg:col-span-6">
        <div className="eyebrow mb-4">The hen diet</div>
        <h2 className="display-2 text-brown mb-6">Real food in.<br/><span className="italic font-normal text-accent">Real nutrition out.</span></h2>
        <p className="lead">
          Our hens are fed a carefully crafted, all-vegetarian diet of corn, soya, flax seeds and organic grains — never antibiotics or growth hormones. The result? Eggs that are naturally richer in Omega-3, protein and essential vitamins.
        </p>
      </div>

      <div className="lg:col-span-6 grid grid-cols-2 gap-5 sm:gap-6">
        {diet.map((d, i) => (
          <div
            key={d.name}
            className="group relative gradient-card rounded-3xl p-7 shadow-soft hover:shadow-card text-center transition-smooth hover:-translate-y-1 border border-border/60 animate-rise"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="text-5xl mb-3 group-hover:scale-110 transition-smooth inline-block">{d.emoji}</div>
            <div className="font-display font-semibold text-brown text-lg">{d.name}</div>
            <div className="text-[11px] uppercase tracking-wider text-accent font-bold mt-1.5">{d.note}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HenDiet;
