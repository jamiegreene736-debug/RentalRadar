import { PropertySearchForm } from "@/components/property-search-form";
import { StoredPropertiesSection } from "@/components/stored-properties-section";
import { getProperties } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const properties = await getProperties();
  const activeProperty = properties[0];

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Saved Properties</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">Property records and scan entry point</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Add, reopen, or rescan saved properties without loading the pricing forecast, rate stack, and scan history on the same page.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)] xl:items-start">
        <PropertySearchForm
          showScrapePreview={false}
          initialAddress={activeProperty?.formatted_address ?? activeProperty?.address_line1 ?? ""}
          title={properties.length ? "Search or update an address" : "Add your first property"}
          description={
            properties.length
              ? "Your saved property is listed below. Rerun scans from that stored record instead of creating a duplicate."
              : "Enter the property address you want RentalRadar to analyze."
          }
        />
        <StoredPropertiesSection properties={properties} compact />
      </div>
    </div>
  );
}
