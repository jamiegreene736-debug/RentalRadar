"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2, Chrome, Table2 } from "lucide-react";

import { marketPulse, recommendations, scrapedRows } from "@/app/(dashboard)/components/dashboard-data";
import { cn } from "@/lib/utils";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tabs = [
  { key: "market", label: "Market Rates", icon: Table2 },
  { key: "recommendations", label: "AI Recommendations", icon: CheckCircle2 },
  { key: "calendar", label: "Calendar Sync", icon: CalendarClock },
  { key: "extension", label: "Extension Status", icon: Chrome },
] as const;

export function PropertyTabs() {
  const [active, setActive] = useState<(typeof tabs)[number]["key"]>("market");

  return (
    <div className="rounded-[28px] border border-white/[0.12] bg-white/[0.045] p-4">
      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-black/[0.2] p-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={cn(
              "flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm transition",
              active === tab.key ? "bg-cyan-300 text-slate-950" : "text-slate-400 hover:bg-white/[0.06] hover:text-white",
            )}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {active === "market" ? <MarketRatesPanel /> : null}
        {active === "recommendations" ? <RecommendationsPanel /> : null}
        {active === "calendar" ? <CalendarSyncPanel /> : null}
        {active === "extension" ? <ExtensionPanel /> : null}
      </div>
    </div>
  );
}

function MarketRatesPanel() {
  if (marketPulse.length === 0 && scrapedRows.length === 0) {
    return <EmptyPanel title="No market rates yet" copy="Market observations will appear here after the first live scan finishes." />;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <div className="h-[320px] rounded-3xl border border-white/10 bg-slate-950/60 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={marketPulse}>
            <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(value) => `$${value}`} />
            <Tooltip
              contentStyle={{
                background: "rgba(5,8,22,0.94)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 16,
                color: "#fff",
              }}
            />
            <Line type="monotone" dataKey="airbnb" stroke="#fb7185" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="vrbo" stroke="#60a5fa" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="booking" stroke="#a78bfa" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="optimized" stroke="#22d3ee" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <DataTable rows={scrapedRows} />
    </div>
  );
}

function RecommendationsPanel() {
  if (recommendations.length === 0) {
    return <EmptyPanel title="No recommendations yet" copy="AI pricing recommendations will appear after real market rates are available." />;
  }

  return (
    <div className="space-y-3">
      {recommendations.map((row) => (
        <div key={row.date} className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/55 p-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
          <div>
            <p className="font-semibold text-white">{row.date}</p>
            <p className="mt-1 text-sm text-slate-400">{row.reason}</p>
          </div>
          <span className="text-sm text-slate-400">Current {row.current}</span>
          <span className="text-xl font-semibold text-cyan-100">{row.recommended}</span>
          <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">{row.confidence}</span>
        </div>
      ))}
    </div>
  );
}

function CalendarSyncPanel() {
  return (
    <EmptyPanel title="No calendar sync yet" copy="Connect a PMS or browser extension after adding a real property." />
  );
}

function ExtensionPanel() {
  return (
    <EmptyPanel title="No extension connection yet" copy="Install and connect an extension after a property exists." />
  );
}

function DataTable({ rows }: { rows: typeof scrapedRows }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/55">
      <div className="grid grid-cols-4 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.18em] text-slate-500">
        <span>Date</span>
        <span>Source</span>
        <span>Rate</span>
        <span>Status</span>
      </div>
      {rows.map((row) => (
        <div key={`${row.source}-${row.date}`} className="grid grid-cols-4 border-b border-white/5 px-4 py-3 text-sm last:border-b-0">
          <span className="text-slate-300">{row.date}</span>
          <span className="text-white">{row.source}</span>
          <span className="font-semibold text-cyan-100">{row.rate}</span>
          <span className="text-slate-400">{row.available}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyPanel({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-3xl border border-cyan-900/10 bg-white/72 p-6">
      <p className="text-lg font-semibold text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
    </div>
  );
}
