import Header from "@/components/site/Header";
import Hero from "@/components/site/Hero";
import AnnouncementBanner from "@/components/site/AnnouncementBanner";
import TrustBadges from "@/components/site/TrustBadges";
import Products from "@/components/site/Products";

import SafetyChecks from "@/components/site/SafetyChecks";
import Benefits from "@/components/site/Benefits";
import HenDiet from "@/components/site/HenDiet";
import FarmStory from "@/components/site/FarmStory";
import FAQ from "@/components/site/FAQ";
import CtaFooter from "@/components/site/CtaFooter";
import StickyCart from "@/components/site/StickyCart";
import Seo from "@/components/Seo";

const Index = () => {
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Eggscellent",
    url: typeof window !== "undefined" ? window.location.origin : "",
    description: "Farm-fresh organic eggs delivered to your doorstep within 24 hours.",
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Eggscellent — Farm Fresh Organic Eggs Delivered to Your Doorstep"
        description="Order hormone-free, naturally fed organic eggs delivered fresh to your home in 24 hours. 9-step quality checks, premium farm-to-home brand."
        jsonLd={orgSchema}
      />
      <Header />
      <AnnouncementBanner />
      <main>
        <Hero />
        <TrustBadges />
        <Products />
        <SafetyChecks />
        <Benefits />
        <HenDiet />
        <FarmStory />
        <FAQ />
        <CtaFooter />
      </main>
      <StickyCart />
    </div>
  );
};

export default Index;
