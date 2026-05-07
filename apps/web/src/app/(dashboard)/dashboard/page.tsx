import { Activity, Building2, Chrome, TrendingUp } from "lucide-react";

import { AiAgentsWidget } from "@/app/(dashboard)/components/ai-agents-widget";
import { properties } from "@/app/(dashboard)/components/dashboard-data";
import { GlassCard, PanelTitle } from "@/app/(dashboard)/components/glass-card";
import { MarketPulseChart } from "@/app/(dashboard)/components/market-pulse-chart";
import { PropertyCard } from "@/app/(dashboard)/components/property-card";

export default function DashboardOverviewPage() {
  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">Overview Dashboard</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-white sm:text-5xl">AI pricing command center</h1>
          <p className="mt-3 max-w-3xl text-slate-400">
            Watch live market scraping, AI recommendations, channel status, and extension readiness across every property.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:w-[620px]">
          <Stat icon={Building2} label="Properties" value="24" />
          <Stat icon={Activity} label="Live scans" value="1,842" />
          <Stat icon={TrendingUp} label="Rev lift" value="+18%" />
          <Stat icon={Chrome} label="Extensions" value="12" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <GlassCard className="p-5">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <PanelTitle eyebrow="Market Pulse" title="Scraped rates vs AI optimized rates" copy="Live comp data from Airbnb, VRBO, Booking.com, and direct PMS channels." />
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs text-emerald-200">streaming</span>
          </div>
          <MarketPulseChart />
        </GlassCard>
        <AiAgentsWidget />
      </div>

      <div>
        <PanelTitle eyebrow="Portfolio" title="Live property cards" copy="Every card shows the latest scrape freshness, recommended rate, and channel health." />
        <div className="mt-5 grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
      <Icon className="mb-3 size-5 text-cyan-200" />
      <p className="text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}
