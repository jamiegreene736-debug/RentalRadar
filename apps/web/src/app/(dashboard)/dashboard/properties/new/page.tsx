import { PanelTitle } from "@/app/(dashboard)/components/glass-card";
import { PropertySearchForm } from "@/components/property-search-form";
import { StoredPropertiesSection } from "@/components/stored-properties-section";
import { getProperties } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function NewPropertyPage() {
  const properties = await getProperties();

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
        <PropertySearchForm />
        <div>
          <PanelTitle
            eyebrow="Add Property"
            title="Search or add an address"
            copy="Enter the property address you want priced. If it already exists, use the stored-property controls below to run another scan."
          />
        </div>
      </div>
      <StoredPropertiesSection properties={properties} />
    </div>
  );
}
