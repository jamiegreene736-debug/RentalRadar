import { GlassCard, PanelTitle } from "@/app/(dashboard)/components/glass-card";
import { PropertySearchForm } from "@/components/property-search-form";
import { StoredPropertiesSection } from "@/components/stored-properties-section";
import { getProperties } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const properties = await getProperties();
  const activeProperty = properties[0];

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
        <PropertySearchForm
          initialAddress={activeProperty?.formatted_address ?? activeProperty?.address_line1 ?? ""}
          title={properties.length ? "Search or update an address" : "Add your first property"}
          description={
            properties.length
              ? "Your saved property is listed below. Rerun scans from that stored record instead of creating a duplicate."
              : "Enter the property address you want RentalRadar to analyze."
          }
        />
        <GlassCard className="p-6">
          <PanelTitle
            eyebrow="Property Detail"
            title="Stored property workspace"
            copy="Saved properties now appear below with rerun controls, detail links, and scan-history access."
          />
        </GlassCard>
      </div>
      <StoredPropertiesSection properties={properties} />
    </div>
  );
}
