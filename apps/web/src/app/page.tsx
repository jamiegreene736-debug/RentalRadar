import { EdgeComparison } from "@/app/components/edge-comparison";
import { ExtensionSpotlight } from "@/app/components/extension-spotlight";
import { FooterCta } from "@/app/components/footer-cta";
import { HeroSection } from "@/app/components/hero-section";
import { HowItWorks } from "@/app/components/how-it-works";
import { PricingTeaser } from "@/app/components/pricing-teaser";
import { RevenueCommandCenter } from "@/app/components/revenue-command-center";
import { SiteHeader } from "@/app/components/site-header";

export default function HomePage() {
  return (
    <main className="radar-light min-h-screen overflow-hidden">
      <SiteHeader />
      <HeroSection />
      <HowItWorks />
      <RevenueCommandCenter />
      <ExtensionSpotlight />
      <EdgeComparison />
      <PricingTeaser />
      <FooterCta />
    </main>
  );
}
