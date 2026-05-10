import { TargetOccupancyPlanner } from "@/components/target-occupancy-planner";
import { getProperties } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function OccupancyPlannerPage() {
  const properties = await getProperties();

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Occupancy Planner</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">Pick the rate that gets booked</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Choose a property, month, and occupancy goal without scrolling through the forecast and scan history first.
        </p>
      </div>
      <TargetOccupancyPlanner properties={properties} />
    </div>
  );
}
