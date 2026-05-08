import { Activity, BrainCircuit, CalendarDays, Gauge, MapPinned, SlidersHorizontal, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { SectionReveal } from "@/app/components/section-reveal";

const proofStats = [
  ["365", "daily rate decisions", "full-year calendar view with fresh recommendations every day"],
  ["24/7", "market monitoring", "traveler demand, comp movement, booking pace, and availability changes"],
  ["98", "listing health score", "pricing, availability, review strength, and conversion signals"],
  ["6", "chart lenses", "revenue, occupancy, average rate, lead time, pickup, and pace"],
];

const strategyModes = [
  {
    icon: TrendingUp,
    title: "Revenue push",
    copy: "Raise rates when demand, events, and booking pace support a stronger nightly rate.",
  },
  {
    icon: Gauge,
    title: "Balanced autopilot",
    copy: "Blend occupancy, revenue, booking lead time, gap nights, and owner guardrails.",
  },
  {
    icon: SlidersHorizontal,
    title: "Occupancy protect",
    copy: "Defend fill rate with controlled discounts, weekday tuning, and minimum-stay moves.",
  },
];

const parameterChips = [
  "days to arrival",
  "day of week",
  "local events",
  "review strength",
  "cleaning fee",
  "cancellation policy",
  "bedroom count",
  "amenity depth",
  "booking pace",
  "availability gaps",
  "seasonality",
  "market supply",
];

const healthRows = [
  ["Listing health", "98", "pricing, availability, and conversion signals"],
  ["52-week view", "365", "daily rates, minimum stays, and seasonal limits"],
  ["Chart lenses", "6", "revenue, occupancy, average rate, lead time, pickup, and pace"],
];

export function ForecastIntelligence() {
  return (
    <section id="forecast-intelligence" className="relative overflow-hidden bg-[#050816] py-24 sm:py-32">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/55 to-transparent" />
      <div className="container">
        <SectionReveal className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">Hybrid pricing intelligence</p>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-normal text-white sm:text-6xl">
            The price is not guessed. It is witnessed, measured, and explained.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            Our AI agents capture what guests actually see right now, while your real booking data keeps everything
            anchored in reality. Every recommendation shows which market move and which booking signal drove the decision.
          </p>
        </SectionReveal>

        <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {proofStats.map(([value, label, note]) => (
            <SectionReveal key={label} className="rounded-[28px] border border-white/[0.12] bg-white/[0.045] p-5">
              <p className="text-4xl font-semibold text-white">{value}</p>
              <p className="mt-3 text-sm font-semibold uppercase tracking-[0.12em] text-cyan-100">{label}</p>
              <p className="mt-3 text-sm leading-6 text-slate-400">{note}</p>
            </SectionReveal>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <SectionReveal className="rounded-[32px] border border-white/[0.12] bg-white/[0.045] p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-100 ring-1 ring-cyan-200/20">
                <BrainCircuit className="size-6" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Strategy presets</p>
                <h3 className="text-2xl font-semibold text-white">Tune for revenue, balance, or occupancy.</h3>
              </div>
            </div>
            <div className="grid gap-3">
              {strategyModes.map((mode) => (
                <StrategyCard key={mode.title} {...mode} />
              ))}
            </div>
          </SectionReveal>

          <SectionReveal className="rounded-[32px] border border-white/[0.12] bg-slate-950/[0.76] p-6 shadow-[0_36px_120px_rgba(0,0,0,0.38)]">
            <div className="grid gap-6 xl:grid-cols-[1fr_0.86fr]">
              <div>
                <div className="mb-5 flex items-center gap-3">
                  <div className="grid size-12 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-100 ring-1 ring-emerald-200/20">
                    <MapPinned className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Local signal map</p>
                    <h3 className="text-2xl font-semibold text-white">Signals behind each recommendation</h3>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {parameterChips.map((chip) => (
                    <span key={chip} className="rounded-full border border-cyan-200/[0.12] bg-cyan-300/[0.06] px-3 py-2 text-xs font-medium text-cyan-50">
                      {chip}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/[0.1] bg-white/[0.04] p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-teal-100">
                  <Activity className="size-4" />
                  Portfolio health
                </div>
                <div className="space-y-3">
                  {healthRows.map(([label, value, note]) => (
                    <div key={label} className="rounded-2xl bg-black/[0.22] p-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm text-slate-300">{label}</p>
                        <p className="text-2xl font-semibold text-white">{value}</p>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-3xl border border-cyan-200/25 bg-slate-900/80 px-5 py-4 text-sm font-medium leading-6 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <CalendarDays className="size-5 text-cyan-200" />
              <span>
                Market rates, booking pace, seasonal rules, weekend adjustments, gap-night discounts, and price limits are all visible before any rate is applied.
              </span>
            </div>
          </SectionReveal>
        </div>
      </div>
    </section>
  );
}

function StrategyCard({ icon: Icon, title, copy }: { icon: LucideIcon; title: string; copy: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-4 rounded-3xl border border-white/[0.1] bg-black/[0.22] p-4">
      <div className="grid size-11 place-items-center rounded-2xl bg-white/[0.07] text-cyan-100">
        <Icon className="size-5" />
      </div>
      <div>
        <h4 className="font-semibold text-white">{title}</h4>
        <p className="mt-1 text-sm leading-6 text-slate-400">{copy}</p>
      </div>
    </div>
  );
}
