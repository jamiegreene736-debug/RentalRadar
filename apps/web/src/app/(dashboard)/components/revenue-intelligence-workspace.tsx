import {
  ArrowUpRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Chrome,
  Gauge,
  LineChart,
  Radar,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  extensionPushQueue,
  liveCompRows,
  marketAlerts,
  portfolioInsights,
  pricingExplanations,
  triggerRules,
  whatIfScenarios,
} from "@/app/(dashboard)/components/dashboard-data";
import { GlassCard, PanelTitle } from "@/app/(dashboard)/components/glass-card";
import { cn } from "@/lib/utils";

const statCards = [
  { label: "Market velocity", value: "+31%", detail: "Search pace vs 14-day baseline", icon: Radar },
  { label: "Live comp changes", value: "14", detail: "Detected in the last 60 minutes", icon: Gauge },
  { label: "Extension pushes", value: "3", detail: "Queued with audit trail", icon: Chrome },
  { label: "Projected uplift", value: "$1.2k", detail: "Next 30 days vs current rates", icon: TrendingUp },
];

export function RevenueIntelligenceWorkspace() {
  return (
    <GlassCard className="overflow-hidden">
      <div className="border-b border-cyan-900/10 bg-slate-950 px-5 py-6 text-white sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PanelTitle
            eyebrow="Competitive Revenue Workspace"
            title="Live evidence, explainable prices, and one-click rate control"
            copy="Built around what public guests and channels are showing right now, with the proof attached to each recommendation."
          />
          <div className="flex w-fit items-center gap-2 rounded-full border border-cyan-200/20 bg-white/[0.06] px-3 py-2 text-sm text-cyan-100">
            <Sparkles className="size-4" />
            AI evidence mode
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="grid size-10 place-items-center rounded-xl bg-cyan-300/12 text-cyan-100">
                  <stat.icon className="size-5" />
                </span>
                <ArrowUpRight className="size-4 text-emerald-200" />
              </div>
              <p className="mt-4 text-3xl font-semibold">{stat.value}</p>
              <p className="mt-1 text-sm font-medium text-cyan-100">{stat.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{stat.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <section className="rounded-[24px] border border-cyan-900/10 bg-white/82 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Live Comp Visualizer</p>
              <h3 className="mt-2 text-xl font-semibold tracking-normal text-slate-950">Market Pulse</h3>
            </div>
            <span className="flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
              <CheckCircle2 className="size-4" />
              Chrome scan online
            </span>
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-cyan-900/10">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_1fr] gap-3 border-b border-cyan-900/10 bg-cyan-50/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <span>Comp</span>
                <span>Rate</span>
                <span>Move</span>
                <span>Supply</span>
                <span>Evidence</span>
              </div>
              {liveCompRows.map((row) => (
                <div
                  key={`${row.platform}-${row.comp}`}
                  className="grid grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_1fr] gap-3 border-b border-cyan-900/10 px-4 py-3 text-sm last:border-b-0"
                >
                  <div>
                    <p className="font-semibold text-slate-950">{row.comp}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.platform}</p>
                  </div>
                  <span className="font-semibold text-slate-900">{row.rate}</span>
                  <span
                    className={cn(
                      "w-fit rounded-full px-2.5 py-1 text-xs font-semibold",
                      row.tone === "alert" && "bg-rose-50 text-rose-700",
                      row.tone === "up" && "bg-emerald-50 text-emerald-700",
                      row.tone === "neutral" && "bg-amber-50 text-amber-700",
                    )}
                  >
                    {row.move}
                  </span>
                  <span className="text-slate-600">{row.availability}</span>
                  <span className="text-slate-500">{row.evidence}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-cyan-900/10 bg-slate-950 p-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Real-Time Alerts</p>
              <h3 className="mt-2 text-xl font-semibold tracking-normal">Change Detection</h3>
            </div>
            <BellRing className="size-5 text-cyan-100" />
          </div>
          <div className="mt-5 space-y-3">
            {marketAlerts.map((alert) => (
              <div key={alert.label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-sm font-semibold text-cyan-100">{alert.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{alert.detail}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">{alert.action}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] border border-cyan-900/10 bg-white/82 p-4 xl:col-span-2">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Transparent AI</p>
              <h3 className="mt-2 text-xl font-semibold tracking-normal text-slate-950">Why This Price?</h3>
            </div>
            <span className="flex w-fit items-center gap-2 rounded-full bg-cyan-50 px-3 py-2 text-xs font-medium text-cyan-800">
              <Sparkles className="size-4" />
              Evidence attached to every rate
            </span>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {pricingExplanations.map((item) => (
              <div key={item.date} className="rounded-2xl border border-cyan-900/10 bg-slate-50/80 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500">{item.date}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-950">
                      {item.current} to {item.recommended}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">{item.confidence}</span>
                </div>
                <div className="mt-4 grid gap-2">
                  {item.evidence.map((evidence) => (
                    <p key={evidence} className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="size-4 shrink-0 text-cyan-700" />
                      {evidence}
                    </p>
                  ))}
                </div>
                <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">AI action</p>
                    <p className="mt-1 text-sm font-medium text-slate-950">{item.action}</p>
                  </div>
                  <span className="text-sm font-semibold text-cyan-800">{item.lift}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] border border-cyan-900/10 bg-slate-950 p-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Extension Control</p>
              <h3 className="mt-2 text-xl font-semibold tracking-normal">Push Queue</h3>
            </div>
            <Chrome className="size-5 text-cyan-100" />
          </div>
          <div className="mt-5 space-y-3">
            {extensionPushQueue.map((push) => (
              <div key={`${push.channel}-${push.dates}`} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{push.channel}</p>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", push.status === "Ready" ? "bg-emerald-300/12 text-emerald-200" : "bg-amber-300/12 text-amber-100")}>
                    {push.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-300">
                  <span>{push.dates}</span>
                  <span className="font-semibold text-cyan-100">{push.change}</span>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            <Zap className="size-4" />
            Send ready pushes
          </button>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <MiniPanel icon={SlidersHorizontal} title="Live Triggers">
            <div className="mt-4 space-y-3">
              {triggerRules.map((rule) => (
                <p key={rule} className="rounded-2xl bg-cyan-50 px-4 py-3 text-sm leading-6 text-slate-700">
                  {rule}
                </p>
              ))}
            </div>
          </MiniPanel>

          <MiniPanel icon={LineChart} title="What-If Lift">
            <div className="mt-4 space-y-3">
              {whatIfScenarios.map((scenario) => (
                <div key={scenario.label} className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <div>
                    <p className="font-semibold text-slate-950">{scenario.label}</p>
                    <p className="text-xs text-slate-500">{scenario.risk} risk</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-cyan-800">{scenario.revenue}</p>
                    <p className="text-xs text-emerald-700">{scenario.lift}</p>
                  </div>
                </div>
              ))}
            </div>
          </MiniPanel>

          <MiniPanel icon={CalendarClock} title="Portfolio Signals">
            <div className="mt-4 space-y-3">
              {portfolioInsights.map((insight) => (
                <div key={insight.label} className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-950">{insight.label}</p>
                    <p className="font-semibold text-cyan-800">{insight.value}</p>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{insight.note}</p>
                </div>
              ))}
            </div>
          </MiniPanel>
        </section>
      </div>
    </GlassCard>
  );
}

function MiniPanel({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="rounded-[24px] border border-cyan-900/10 bg-white/82 p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-cyan-50 text-cyan-800">
          <Icon className="size-5" />
        </span>
        <h3 className="text-lg font-semibold tracking-normal text-slate-950">{title}</h3>
      </div>
      {children}
    </div>
  );
}
