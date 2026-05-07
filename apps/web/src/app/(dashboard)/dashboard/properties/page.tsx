import { GlassCard, PanelTitle } from "@/app/(dashboard)/components/glass-card";
import { PropertySearchForm } from "@/components/property-search-form";

export default function PropertiesPage() {
  return (
    <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
      <PropertySearchForm />
      <GlassCard className="p-6">
        <PanelTitle
          eyebrow="Property Detail"
          title="Search or add an address"
          copy="Enter the property address you want RentalRadar to analyze. After the first scan, this area will become the detail page for that property with market data, recommendations, and channel setup."
        />
      </GlassCard>
    </div>
  );
}
