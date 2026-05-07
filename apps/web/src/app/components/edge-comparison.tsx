import { Check, Minus, X } from "lucide-react";

import { SectionReveal } from "@/app/components/section-reveal";

const rows = [
  ["Smart price recommendations", "yes", "yes", "yes", "yes", "yes", "limited", "limited"],
  ["Checks the rates guests can see online", "yes", "market feeds", "market feeds", "market feeds", "market feeds", "Airbnb only", "market data"],
  ["Real booking and revenue signals", "yes", "yes", "yes", "yes", "yes", "limited", "market data"],
  ["Price limits and guardrails", "yes", "yes", "yes", "yes", "yes", "limited", "limited"],
  ["Custom strategy controls", "yes", "yes", "yes", "yes", "yes", "limited", "limited"],
  ["Discount, weekend, and seasonal rules", "yes", "yes", "yes", "yes", "yes", "limited", "limited"],
  ["Event and demand forecasting", "yes", "yes", "yes", "yes", "yes", "limited", "yes"],
  ["Minimum-stay and availability controls", "yes", "yes", "yes", "yes", "yes", "limited", "no"],
  ["Listing health and portfolio analytics", "yes", "yes", "yes", "limited", "limited", "no", "yes"],
  ["Local market intelligence", "live comps + bookings", "yes", "yes", "yes", "yes", "Airbnb only", "yes"],
  ["Comparable rental management", "suggested comps", "yes", "yes", "limited", "limited", "no", "limited"],
  ["Map and neighborhood analysis", "yes", "yes", "yes", "limited", "yes", "limited", "yes"],
  ["Can update rates without a PMS", "yes", "no", "limited", "limited", "limited", "native only", "no"],
  ["Works even before a full PMS connection", "yes", "limited", "limited", "limited", "limited", "Airbnb only", "no"],
  ["Entry pricing model", "$3-$9", "varies", "varies", "varies", "varies", "included", "varies"],
];

const columns = ["RentalRadar", "DPGO", "PriceLabs", "Beyond Pricing", "Wheelhouse", "Airbnb Smart Pricing", "AirDNA Smart Rates"];

export function EdgeComparison() {
  return (
    <section id="comparison" className="bg-[#070b1a] py-24 sm:py-32">
      <div className="container">
        <SectionReveal className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">Feature comparison</p>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-normal text-white sm:text-6xl">
            Compare the tools before you commit.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            See how RentalRadar compares on rate recommendations, market visibility, portfolio controls, and ways to publish approved prices.
          </p>
        </SectionReveal>

        <SectionReveal className="mt-14 overflow-x-auto rounded-[28px] border border-white/[0.12] bg-white/[0.04] shadow-[0_32px_100px_rgba(0,0,0,0.32)]">
          <div className="min-w-[1320px]">
            <div className="grid grid-cols-[1.42fr_repeat(7,1fr)] border-b border-white/10 bg-white/[0.04] text-sm font-semibold text-white">
              <div className="p-4 sm:p-5">Capability</div>
              {columns.map((column, index) => (
                <div key={column} className={`border-l border-white/10 p-4 sm:p-5 ${index === 0 ? "text-cyan-100" : "text-slate-300"}`}>
                  {column}
                </div>
              ))}
            </div>
            {rows.map(([feature, rentalRadar, dpgo, priceLabs, beyondPricing, wheelhouse, airbnbSmartPricing, airDnaSmartRates]) => (
              <div key={feature} className="grid grid-cols-[1.42fr_repeat(7,1fr)] border-b border-white/[0.08] text-sm last:border-b-0">
                <div className="p-4 text-slate-200 sm:p-5">{feature}</div>
                <Cell value={rentalRadar} highlight />
                <Cell value={dpgo} />
                <Cell value={priceLabs} />
                <Cell value={beyondPricing} />
                <Cell value={wheelhouse} />
                <Cell value={airbnbSmartPricing} />
                <Cell value={airDnaSmartRates} />
              </div>
            ))}
          </div>
        </SectionReveal>
        <p className="mt-4 text-center text-xs leading-5 text-slate-500">
          Feature availability can change. This table is intended as a high-level buying guide, not an account-level audit of every plan.
        </p>
      </div>
    </section>
  );
}

function Cell({ value, highlight = false }: { value: string; highlight?: boolean }) {
  const normalized = value.toLowerCase();
  const icon =
    normalized === "yes" ? (
      <Check className="size-4 text-emerald-200" />
    ) : normalized === "no" ? (
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
