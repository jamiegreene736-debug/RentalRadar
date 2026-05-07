import { EdgeComparison } from "@/app/components/edge-comparison";
import { ExtensionSpotlight } from "@/app/components/extension-spotlight";
import { FooterCta } from "@/app/components/footer-cta";
import { HeroSection } from "@/app/components/hero-section";
import { HowItWorks } from "@/app/components/how-it-works";
import { PricingTeaser } from "@/app/components/pricing-teaser";
import { SiteHeader } from "@/app/components/site-header";

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050816] text-white">
      <SiteHeader />
      <HeroSection />
      <HowItWorks />
      <ExtensionSpotlight />
      <EdgeComparison />
      <PricingTeaser />
      <FooterCta />
    </main>
  );
}
