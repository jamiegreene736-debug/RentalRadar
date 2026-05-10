import { PricingControlsWorkspace } from "@/components/pricing-controls-workspace";
import { getProperties } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function PricingControlsPage() {
  const properties = await getProperties();
  return <PricingControlsWorkspace properties={properties} />;
}
