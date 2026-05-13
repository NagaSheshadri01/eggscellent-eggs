import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useFaqs } from "@/hooks/useFaqs";
import { useSiteSection } from "@/hooks/useSiteContent";

const FAQ = () => {
  const { data: faqs = [] } = useFaqs({ onlyActive: true });
  const s = useSiteSection("faq_section", { eyebrow: "Questions", headline_left: "Curious?", headline_right: "We've got answers." });

  return (
    <section className="py-24 lg:py-32 bg-secondary/30">
      <div className="container max-w-3xl">
        <div className="text-center mb-14">
          <div className="eyebrow mb-4">{s.eyebrow}</div>
          <h2 className="display-2 text-brown">{s.headline_left} <span className="italic font-normal text-accent">{s.headline_right}</span></h2>
        </div>
        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((f, i) => (
            <AccordionItem
              key={f.id}
              value={`item-${i}`}
              className="bg-card rounded-2xl px-6 border border-border/60 shadow-soft hover:shadow-card transition-smooth"
            >
              <AccordionTrigger className="text-left font-display font-semibold text-brown text-lg hover:no-underline py-6">{f.question}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed pb-6 text-base">{f.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FAQ;
