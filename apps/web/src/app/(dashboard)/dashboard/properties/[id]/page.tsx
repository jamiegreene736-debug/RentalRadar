import { MapPin } from "lucide-react";

import { GlassCard, PanelTitle } from "@/app/(dashboard)/components/glass-card";
import { PropertyTabs } from "@/app/(dashboard)/components/property-tabs";
import { LiveScrapeScreens } from "@/components/live-scrape-screens";
import { PropertySearchForm } from "@/components/property-search-form";
import { ScanHistory } from "@/components/scan-history";
import { StoredPropertiesSection } from "@/components/stored-properties-section";
import { TargetOccupancyPlanner } from "@/components/target-occupancy-planner";
import { getProperties } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const savedProperties = await getProperties();
  const property = savedProperties.find((item) => item.id === id);

  if (!property) {
    return (
      <div className="grid gap-6">
        <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
          <PropertySearchForm />
          <GlassCard className="p-6">
            <PanelTitle
              eyebrow="Property Detail"
              title="Property not found"
              copy="This detail page is only for saved backend properties. Use the stored-property list below or search the address again."
            />
          </GlassCard>
        </div>
        <StoredPropertiesSection properties={savedProperties} />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-700">Property Detail</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
            {property.name || property.formatted_address || property.address_line1}
          </h1>
          <p className="mt-3 flex items-center gap-2 text-slate-600">
            <MapPin className="size-4 text-cyan-800" />
            {property.formatted_address || property.address_line1}
          </p>
          <StoredPropertiesSection properties={[property]} />
        </div>
        <PropertySearchForm
          initialAddress={property.formatted_address ?? property.address_line1}
          title="Search another address"
          description="The current property is saved. Search here only if you want to add a different property."
        />
      </div>

      <GlassCard className="p-5">
        <PanelTitle eyebrow="Map" title="Local market center" copy="Google Maps embed-ready container for address geocoding and nearby comp discovery." />
        <div className="map-grid mt-5 grid h-72 place-items-center rounded-3xl border border-cyan-200/20 bg-cyan-300/10 text-center">
          <div>
            <MapPin className="mx-auto mb-3 size-8 text-cyan-800" />
            <p className="font-semibold text-slate-950">{property.formatted_address || property.address_line1}</p>
            <p className="mt-1 text-sm text-slate-600">Google Maps embed key plugs in here.</p>
          </div>
        </div>
      </GlassCard>

      <TargetOccupancyPlanner propertyId={property.id} properties={savedProperties} />
      <LiveScrapeScreens propertyId={property.id} />
      <ScanHistory propertyId={property.id} />
      <PropertyTabs />
    </div>
  );
}
