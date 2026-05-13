import { Button } from "@/components/ui/button";
import { useSiteSection } from "@/hooks/useSiteContent";

const CtaFooter = () => {
  const scroll = () => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
  const cta = useSiteSection("cta_footer", { eyebrow: "Get started", headline: "Start your healthy routine — every morning.", subhead: "Premium eggs. Honest farming. Delivered fresh, every morning.", cta_label: "Order Now" });
  const footer = useSiteSection<{ copyright: string; links: { label: string; href: string }[] }>("footer", { copyright: "Eggscellent. Farm fresh, always.", links: [{label:"Contact",href:"#"},{label:"Privacy",href:"#"},{label:"Terms",href:"#"}] });
  return (
    <>
      <section className="relative py-28 lg:py-40 gradient-brown text-brown-foreground overflow-hidden">
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full gradient-yolk opacity-20 blur-3xl" />

        <div className="container relative text-center max-w-3xl">
          <div className="eyebrow text-primary mb-5">{cta.eyebrow}</div>
          <h2 className="display-1 text-brown-foreground leading-[1.05]">
            {cta.headline}
          </h2>
          <p className="lead mt-6 text-brown-foreground/75 max-w-xl mx-auto">
            {cta.subhead}
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Button variant="hero" size="xl" onClick={scroll} className="group">
              {cta.cta_label}
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Button>
          </div>
        </div>
      </section>

      <footer className="py-10 bg-background border-t border-border/60">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full gradient-yolk grid place-items-center">
              <span className="text-brown font-display font-bold text-sm">e</span>
            </div>
            <span>© {new Date().getFullYear()} {footer.copyright}</span>
          </div>
          <div className="flex gap-6">
            {(footer.links ?? []).map((l, i) => (
              <a key={i} href={l.href} className="hover:text-brown transition-smooth">{l.label}</a>
            ))}
          </div>
        </div>
      </footer>
    </>
  );
};

export default CtaFooter;
