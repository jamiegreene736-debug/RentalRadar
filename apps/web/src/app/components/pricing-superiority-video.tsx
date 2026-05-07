import { ArrowRight, BrainCircuit, Chrome, LineChart, ShieldCheck } from "lucide-react";

import { SectionReveal } from "@/app/components/section-reveal";

const proofPoints = [
  {
    icon: Chrome,
    title: "Sees the live market",
    copy: "Playwright AI agents run in headed Chrome to check what travelers can actually book across Airbnb, VRBO, and Booking.com.",
  },
  {
    icon: LineChart,
    title: "Blends revenue signals",
    copy: "Recommendations weigh comp prices, lead time, occupancy, pickup, and booked revenue together.",
  },
  {
    icon: ShieldCheck,
    title: "Executes with guardrails",
    copy: "Rate moves are explainable, bounded by owner rules, and ready for PMS or extension publishing.",
  },
];

export function PricingSuperiorityVideo() {
  return (
    <section id="demo" className="relative overflow-hidden py-24 sm:py-32">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
      <div className="container">
        <SectionReveal className="grid items-end gap-8 lg:grid-cols-[0.88fr_1fr]">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-700">
              <BrainCircuit className="size-4" />
              47-second overview
            </p>
            <h2 className="mt-4 max-w-3xl text-balance text-4xl font-semibold tracking-normal text-slate-950 sm:text-6xl">
              Why RentalRadar pricing is superior.
            </h2>
          </div>
          <p className="max-w-2xl text-lg leading-8 text-slate-600">
            Better pricing starts with the ultimate evidence stack: Playwright agents in headed Chrome, live guest-visible rates,
            your real booking performance, and a guarded execution path that can publish the decision.
          </p>
        </SectionReveal>

        <SectionReveal className="mt-12 overflow-hidden rounded-[28px] border border-cyan-900/15 bg-white/72 shadow-[0_34px_120px_rgba(14,116,144,0.16)]">
          <div className="grid gap-0 xl:grid-cols-[1fr_330px]">
            <div className="relative bg-slate-950">
              <video
                className="aspect-video h-full w-full object-cover"
                src="/pricing-superiority-overview.mp4"
                poster="/pricing-superiority-poster.jpg"
                autoPlay
                loop
                muted
                playsInline
                controls
                preload="metadata"
                aria-label="RentalRadar pricing superiority product overview video"
              />
            </div>
            <div className="border-t border-cyan-900/15 bg-white/82 p-6 xl:border-l xl:border-t-0">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">Product film</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">See, decide, explain, push.</p>
                </div>
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-cyan-300 text-slate-950">
                  <ArrowRight className="size-5" />
                </span>
              </div>

              <div className="mt-8 space-y-5">
                {proofPoints.map((point) => (
                  <div key={point.title} className="grid grid-cols-[auto_1fr] gap-4">
                    <span className="grid size-11 place-items-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-900/10">
                      <point.icon className="size-5" />
                    </span>
                    <div>
                      <p className="font-semibold text-slate-950">{point.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{point.copy}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 grid grid-cols-3 gap-3 text-center">
                {[
                  ["47s", "overview"],
                  ["3", "channels"],
                  ["24/7", "checks"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-2xl border border-cyan-900/10 bg-cyan-50/70 px-3 py-4">
                    <p className="text-2xl font-semibold text-slate-950">{value}</p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-cyan-700">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
