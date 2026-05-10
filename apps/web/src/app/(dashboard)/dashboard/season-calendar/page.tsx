import { SeasonCalendarWorkspace } from "@/components/season-calendar-workspace";
import { getProperties } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function SeasonCalendarPage() {
  const properties = await getProperties();
  return <SeasonCalendarWorkspace properties={properties} />;
}
