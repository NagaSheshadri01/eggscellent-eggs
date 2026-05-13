import { Leaf, ShieldCheck, Wheat, FlaskConical, Sprout } from "lucide-react";

const badges = [
  { icon: ShieldCheck, label: "Hormone-Free" },
  { icon: FlaskConical, label: "Antibiotic-Free" },
  { icon: Wheat, label: "Naturally Fed" },
  { icon: Leaf, label: "No Chemical Residue" },
  { icon: Sprout, label: "Farm Fresh" },
];

const TrustBadges = () => (
  <section className="py-8 bg-card/60 border-y border-border/60 backdrop-blur-sm">
    <div className="container">
      <div className="flex gap-3 sm:gap-6 overflow-x-auto no-scrollbar sm:justify-center items-center">
        {badges.map(({ icon: Icon, label }, i) => (
          <div key={label} className="flex items-center gap-3">
            {i > 0 && <div className="hidden sm:block w-1 h-1 rounded-full bg-border" />}
            <div className="flex-shrink-0 flex items-center gap-2.5 whitespace-nowrap">
              <Icon className="w-4 h-4 text-accent" strokeWidth={2} />
              <span className="text-sm font-semibold text-brown tracking-tight">{label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TrustBadges;
