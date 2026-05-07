import { Activity, Bot, Code2, ShieldCheck } from "lucide-react";

import { AgentLogTimeline } from "@/app/(dashboard)/components/agent-log-timeline";
import { GlassCard } from "@/app/(dashboard)/components/glass-card";

export default function AiScrapingLogPage() {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">AI Scraping Log</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal text-white sm:text-5xl">Every agent decision, visible.</h1>
        <p className="mt-3 max-w-3xl text-slate-400">
          A live timeline of locator training, headed Chrome validation, retries, and self-healing patches.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <MiniMetric icon={Bot} label="Agents running" value="14" />
        <MiniMetric icon={Code2} label="Locator patches today" value="38" />
        <MiniMetric icon={ShieldCheck} label="Successful runs" value="96.8%" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <AgentLogTimeline />
        <GlassCard className="h-fit p-5">
          <Activity className="size-7 text-cyan-100" />
          <h2 className="mt-4 text-xl font-semibold text-white">Realtime stream ready</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            This timeline is wired as a premium UI shell for Server-Sent Events or WebSocket updates from the browser farm and FastAPI scraping jobs.
          </p>
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/[0.25] p-4 font-mono text-xs text-cyan-100">
            EventSource('/api/agent-events')
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function MiniMetric({ icon: Icon, label, value }: { icon: typeof Bot; label: string; value: string }) {
  return (
    <GlassCard className="p-5">
      <Icon className="size-5 text-cyan-200" />
      <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </GlassCard>
  );
}
