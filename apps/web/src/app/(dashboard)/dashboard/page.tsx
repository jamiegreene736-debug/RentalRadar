import { Building2, Chrome, PlugZap, Radar } from "lucide-react";

import { GlassCard, PanelTitle } from "@/app/(dashboard)/components/glass-card";
import { PropertySearchForm } from "@/components/property-search-form";

const setupSteps = [
  {
    icon: Building2,
    title: "Add a property",
    copy: "Start with the address so RentalRadar can build the first market scan around the right location.",
  },
  {
    icon: PlugZap,
    title: "Connect a source",
    copy: "Add a PMS or channel connection after the property exists. Until then, nothing is shown as connected.",
  },
  {
    icon: Radar,
    title: "Review real recommendations",
    copy: "Rate charts, agent logs, and pricing recommendations appear only after scans return live data.",
  },
];

export default function DashboardOverviewPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px] xl:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-700">Overview Dashboard</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
            Start with your first property
          </h1>
          <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
            Add the address you want analyzed. Once RentalRadar has real property and channel data, this dashboard will fill
            with live scans, recommendations, and connection status.
          </p>
        </div>
        <GlassCard className="p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cyan-100 text-cyan-800">
              <Chrome className="size-5" />
            </span>
            <div>
              <p className="font-semibold text-slate-950">No live data yet</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Sample properties, scan counts, and fake agent activity have been removed from the new-account view.
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
        <PropertySearchForm />
        <GlassCard className="p-6">
          <PanelTitle
            eyebrow="What happens next"
            title="A real dashboard appears after your first scan"
            copy="RentalRadar will use the property address and any competitor links you provide to queue market research. Empty states stay empty until that real data exists."
          />
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {setupSteps.map((step) => (
              <div key={step.title} className="rounded-3xl border border-cyan-900/10 bg-white/70 p-5">
                <span className="grid size-11 place-items-center rounded-2xl bg-cyan-100 text-cyan-800">
                  <step.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-950">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.copy}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <EmptyMetric label="Properties" value="0" />
        <EmptyMetric label="Market scans" value="0" />
        <EmptyMetric label="Connected channels" value="0" />
      </div>
    </div>
  );
}

function EmptyMetric({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard className="p-5">
      <p className="text-3xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{label}</p>
      <p className="mt-4 text-xs uppercase tracking-[0.18em] text-cyan-700">Waiting for real data</p>
    </GlassCard>
  );
}
