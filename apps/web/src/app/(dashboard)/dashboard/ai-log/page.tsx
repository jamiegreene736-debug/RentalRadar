import { Activity, Bot, Code2, ShieldCheck } from "lucide-react";

import { GlassCard } from "@/app/(dashboard)/components/glass-card";
import { ScanHistory } from "@/components/scan-history";
import { getProperties } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function AiScrapingLogPage() {
  const properties = await getProperties();
  const activeProperty = properties[0];

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-700">AI Scraping Log</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">Saved scan history.</h1>
        <p className="mt-3 max-w-3xl text-slate-600">
          Browser sessions, screenshots, queue pickup, and terminal events are saved to the backend so they remain visible after you leave the tab.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <MiniMetric icon={Bot} label="Properties watched" value={String(properties.length)} />
        <MiniMetric icon={Code2} label="History source" value="DB" />
        <MiniMetric icon={ShieldCheck} label="Evidence saved" value="Yes" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <ScanHistory propertyId={activeProperty?.id} />
        <GlassCard className="h-fit p-5">
          <Activity className="size-7 text-cyan-800" />
          <h2 className="mt-4 text-xl font-semibold text-slate-950">Runs continue server-side</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Closing or leaving the browser tab does not cancel the queued scrape jobs. This page reloads the latest saved state from FastAPI every few seconds.
          </p>
          <div className="mt-5 rounded-2xl border border-slate-950/10 bg-slate-950 p-4 font-mono text-xs text-cyan-100">
            GET /properties/:id/scrape-sessions
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function MiniMetric({ icon: Icon, label, value }: { icon: typeof Bot; label: string; value: string }) {
  return (
    <GlassCard className="p-5">
      <Icon className="size-5 text-cyan-800" />
      <p className="mt-4 text-3xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{label}</p>
    </GlassCard>
  );
}
