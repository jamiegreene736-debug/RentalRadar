import { QueuedScansWorkspace } from "@/components/queued-scans-workspace";
import { getProperties } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function QueuedScansPage() {
  const properties = await getProperties();
  return <QueuedScansWorkspace properties={properties} />;
}
