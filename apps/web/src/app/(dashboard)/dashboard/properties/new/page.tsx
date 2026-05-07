import { PanelTitle } from "@/app/(dashboard)/components/glass-card";
import { PropertySearchForm } from "@/components/property-search-form";

export default function NewPropertyPage() {
  return (
    <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
      <PropertySearchForm />
      <div>
        <PanelTitle
          eyebrow="Add Property"
          title="Search or add an address"
          copy="Enter the property address you want priced. After the property is created, market scans and recommendations can be queued from the backend."
        />
      </div>
    </div>
  );
}
