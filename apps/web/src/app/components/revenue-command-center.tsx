import { BarChart3, BellRing, Blocks, Braces, CircleDollarSign, FileChartColumn, Map, RadioTower, SlidersHorizontal, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { SectionReveal } from "@/app/components/section-reveal";

const commandModules = [
  {
    icon: RadioTower,
    title: "Market-demand radar",
    copy: "See live rates, open dates, amenity positioning, event pressure, and demand gaps before they show up in stale market averages.",
  },
  {
    icon: Map,
    title: "Real booking context",
    copy: "Ground every market observation with booked nightly rates, occupancy, booking lead time, cancellations, channel mix, and revenue pace where available.",
  },
  {
    icon: SlidersHorizontal,
    title: "Portfolio controls",
    copy: "Bulk-edit base prices, minimum stays, gap-night rules, event overrides, floors, ceilings, and seasonal strategies by segment.",
  },
  {
    icon: FileChartColumn,
    title: "Owner-ready reporting",
    copy: "Turn revenue, occupancy, average nightly rate, revenue per night, pacing, and booking activity into clean owner updates without exporting spreadsheet chaos.",
  },
  {
    icon: BellRing,
    title: "Alerts and issue detection",
    copy: "Flag underpriced events, orphan nights, low conversion windows, booking slowdowns, and listings falling behind their market.",
  },
  {
    icon: Braces,
    title: "Connects to your tools",
    copy: "Share recommendations, comparable rentals, booking signals, market reports, and change history with the systems your team already uses.",
  },
];

const forecastRows = [
  ["July bookings", "+18%", "Raise weekends"],
  ["Labor Day", "2.4x demand", "Hold rate floor"],
  ["Ocean-view comps", "$412 avg.", "Push +9%"],
  ["Owner report", "Ready", "Send PDF"],
];

const analytics = [
  ["Pacing", "84%", "ahead of budget"],
  ["Rule test", "+6.8%", "min-stay lift"],
  ["Revenue per night", "+14%", "same homes"],
  ["Slow bookings", "3 homes", "needs action"],
];

export function RevenueCommandCenter() {
  return (
    <section id="market-intelligence" className="relative overflow-hidden bg-[#07111f] py-24 sm:py-32">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/45 to-transparent" />
      <div className="container">
        <SectionReveal className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-200">Complete revenue command center</p>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-normal text-white sm:text-6xl">
            Market, portfolio, and owner reporting in one live workspace.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            RentalRadar brings current market rates, real booking data, comparable rentals, portfolio controls, performance analytics, and owner-ready reporting into one place.
          </p>
        </SectionReveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-[0.94fr_1.06fr] lg:items-start">
          <SectionReveal className="grid gap-4 sm:grid-cols-2">
            {commandModules.map((module) => (
              <CapabilityCard key={module.title} {...module} />
            ))}
          </SectionReveal>

          <SectionReveal className="relative">
            <div className="absolute -inset-6 rounded-[36px] bg-emerald-300/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[32px] border border-white/[0.12] bg-slate-950/[0.78] shadow-[0_36px_130px_rgba(0,0,0,0.44)]">
              <div className="border-b border-white/10 p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-400">Revenue workspace</p>
                    <h3 className="mt-1 text-2xl font-semibold text-white">Kauai luxury homes</h3>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">
                    <CircleDollarSign className="size-4" />
                    $18,420 forecast lift
                  </div>
                </div>
              </div>

              <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-cyan-100">
                    <Blocks className="size-4" />
                    Rate opportunities to act on
                  </div>
                  <div className="space-y-3">
                    {forecastRows.map(([signal, value, action]) => (
                      <div key={signal} className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4">
                        <div>
                          <p className="text-sm font-medium text-white">{signal}</p>
                          <p className="mt-1 text-xs text-slate-400">{action}</p>
                        </div>
                        <span className="self-start rounded-full bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-teal-100">
                    <BarChart3 className="size-4" />
                    Booking performance and owner proof
                  </div>
                  <div className="grid gap-3">
                    {analytics.map(([label, value, note]) => (
                      <div key={label} className="rounded-2xl bg-white/[0.04] p-4">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-sm text-slate-300">{label}</p>
                          <p className="text-xl font-semibold text-white">{value}</p>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 bg-white/[0.035] p-5">
                <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <UsersRound className="size-4 text-emerald-200" />
                    Live market checks
                  </div>
                  <div className="flex items-center gap-2">
                    <FileChartColumn className="size-4 text-cyan-200" />
                    PDF snapshots
                  </div>
                  <div className="flex items-center gap-2">
                    <Braces className="size-4 text-teal-200" />
                    Tool connections
                  </div>
                </div>
              </div>
            </div>
          </SectionReveal>
        </div>
      </div>
    </section>
  );
}

function CapabilityCard({ icon: Icon, title, copy }: { icon: LucideIcon; title: string; copy: string }) {
  return (
    <div className="rounded-[28px] border border-white/[0.12] bg-white/[0.045] p-5">
      <div className="mb-5 grid size-11 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-100 ring-1 ring-emerald-200/20">
        <Icon className="size-5" />
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-300">{copy}</p>
    </div>
  );
}
