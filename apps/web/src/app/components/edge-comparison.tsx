import { Check, Minus, X } from "lucide-react";

import { SectionReveal } from "@/app/components/section-reveal";

const rows = [
  ["Real AI-trained scraping", "yes", "limited", "no"],
  ["Real headed Chrome browser farm", "yes", "limited", "no"],
  ["Live Airbnb, VRBO, Booking.com comp scans", "yes", "limited", "limited"],
  ["Direct browser extension rate pushing", "yes", "limited", "no"],
  ["Self-healing locator training", "yes", "limited", "no"],
  ["Ultra-low per-property pricing", "$3-$9", "higher", "higher"],
];

export function EdgeComparison() {
  return (
    <section id="comparison" className="bg-[#070b1a] py-24 sm:py-32">
      <div className="container">
        <SectionReveal className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">The edge</p>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-normal text-white sm:text-6xl">
            Live pricing intelligence where it matters.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            RentalRadar prices from live adaptive data instead of stale feeds and generic calendars.
          </p>
        </SectionReveal>

        <SectionReveal className="mt-14 overflow-x-auto rounded-[28px] border border-white/[0.12] bg-white/[0.04] shadow-[0_32px_100px_rgba(0,0,0,0.32)]">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] border-b border-white/10 bg-white/[0.04] text-sm font-semibold text-white">
              <div className="p-4 sm:p-5">Capability</div>
              <div className="border-l border-white/10 p-4 text-cyan-100 sm:p-5">RentalRadar</div>
              <div className="border-l border-white/10 p-4 text-slate-300 sm:p-5">Legacy calendar tools</div>
              <div className="border-l border-white/10 p-4 text-slate-300 sm:p-5">Manual workflows</div>
            </div>
            {rows.map(([feature, rentalRadar, legacyTools, manualWorkflows]) => (
              <div key={feature} className="grid grid-cols-[1.3fr_1fr_1fr_1fr] border-b border-white/[0.08] text-sm last:border-b-0">
                <div className="p-4 text-slate-200 sm:p-5">{feature}</div>
                <Cell value={rentalRadar} highlight />
                <Cell value={legacyTools} />
                <Cell value={manualWorkflows} />
              </div>
            ))}
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}

function Cell({ value, highlight = false }: { value: string; highlight?: boolean }) {
  const icon =
    value === "yes" ? (
      <Check className="size-4 text-emerald-200" />
    ) : value === "no" ? (
      <X className="size-4 text-rose-300" />
    ) : (
      <Minus className="size-4 text-amber-200" />
    );
  return (
    <div className={`flex items-center gap-2 border-l border-white/10 p-4 sm:p-5 ${highlight ? "bg-cyan-300/[0.06] text-cyan-50" : "text-slate-300"}`}>
      {icon}
      <span>{value}</span>
    </div>
  );
}
