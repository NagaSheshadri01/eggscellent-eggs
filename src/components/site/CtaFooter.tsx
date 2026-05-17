import { Button } from "@/components/ui/button";
import { useSiteSection } from "@/hooks/useSiteContent";
import { useAppSettings } from "@/hooks/useAppSettings";
import { Phone, Mail, MessageCircle } from "lucide-react";

const CtaFooter = () => {
  const { data: settings } = useAppSettings();
  const business = settings?.business || { business_name: "Eggscellent", support_phone: "", support_email: "", whatsapp_number: "" };
  
  const scroll = () => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
  const cta = useSiteSection("cta_footer", { eyebrow: "Get started", headline: "Start your healthy routine — every morning.", subhead: "Premium eggs. Honest farming. Delivered fresh, every morning.", cta_label: "Order Now" });
  const footer = useSiteSection<{ copyright: string; show_support?: boolean; links: { label: string; href: string }[] }>("footer", { 
    copyright: "Eggscellent. Farm fresh, always.", 
    show_support: false,
    links: [{label:"Contact",href:"#"},{label:"Privacy",href:"#"},{label:"Terms",href:"#"}] 
  });
  
  const hasSupport = business.support_phone || business.support_email || business.whatsapp_number;
  const displaySupport = footer.show_support && hasSupport;
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

      <footer className="py-12 bg-background border-t border-border/60">
        <div className="container space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8">
            <div className="space-y-4 max-w-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full gradient-yolk grid place-items-center">
                  <span className="text-brown font-display font-bold text-sm">{(business.business_name || "e").charAt(0).toLowerCase()}</span>
                </div>
                <span className="font-display font-bold text-brown text-xl tracking-tight">{business.business_name}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {footer.copyright}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 sm:gap-12">
              {displaySupport && (
                <div className="space-y-4">
                  <h4 className="font-display font-bold text-brown text-sm uppercase tracking-wider">Support</h4>
                  <ul className="space-y-2.5 text-sm text-muted-foreground">
                    {business.support_phone && (
                      <li><a href={`tel:${business.support_phone}`} className="flex items-center gap-2 hover:text-brown transition-smooth"><Phone className="w-3.5 h-3.5 text-primary" /> {business.support_phone}</a></li>
                    )}
                    {business.support_email && (
                      <li><a href={`mailto:${business.support_email}`} className="flex items-center gap-2 hover:text-brown transition-smooth"><Mail className="w-3.5 h-3.5 text-primary" /> Email Us</a></li>
                    )}
                    {business.whatsapp_number && (
                      <li><a href={`https://wa.me/${business.whatsapp_number.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-brown transition-smooth"><MessageCircle className="w-3.5 h-3.5 text-primary" /> WhatsApp</a></li>
                    )}
                  </ul>
                </div>
              )}
              <div className="space-y-4">
                <h4 className="font-display font-bold text-brown text-sm uppercase tracking-wider">Links</h4>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  {(footer.links ?? []).map((l, i) => (
                    <li key={i}><a href={l.href} className="hover:text-brown transition-smooth">{l.label}</a></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-muted-foreground">
            <span>© {new Date().getFullYear()} {business.business_name}. All rights reserved.</span>
            <div className="flex gap-6">
              <a href="#" className="hover:text-brown transition-smooth">Privacy Policy</a>
              <a href="#" className="hover:text-brown transition-smooth">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default CtaFooter;
