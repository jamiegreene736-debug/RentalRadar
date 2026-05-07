import Link from "next/link";
import { ArrowRight, CheckCircle2, Cpu, ShieldCheck, Zap } from "lucide-react";

import { SectionReveal } from "@/app/components/section-reveal";
import { Button } from "@/components/ui/button";
import { getStartedHref } from "@/lib/site-config";

const tiers = [
  {
    name: "Starter",
    price: "$3",
    cadence: "Daily live scans",
    feature: "AI price explanations",
    bestFor: "First listing",
  },
  {
    name: "Growth",
    price: "$6",
    cadence: "4x daily live scans",
    feature: "PMS pushes and alerts",
    bestFor: "2-10 listings",
  },
  {
    name: "Pro",
    price: "$9",
    cadence: "Hourly live scans",
    feature: "Extension queue and triggers",
    bestFor: "Portfolio operators",
  },
];

const proofPoints = [
  "Flat fee per property with no revenue-share surprise",
  "Live comp evidence attached to every recommendation",
  "Browser extension rate pushes included on Pro",
];

export function PricingTeaser() {
  return (
    <section id="pricing" className="relative overflow-hidden bg-[#050816] py-24 sm:py-32">
      <div className="absolute left-1/2 top-0 h-px w-[80vw] -translate-x-1/2 bg-gradient-to-r from-transparent via-teal-300/50 to-transparent" />
      <div className="container">
        <SectionReveal className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-200">Flat-fee pricing</p>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-normal text-white sm:text-6xl">
            Simple pricing that does not grow with your revenue.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            RentalRadar keeps pricing simple: $3-$9 per property/month, live AI scans included, and no percentage skim from your best months.
          </p>
        </SectionReveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {tiers.map((tier) => (
            <SectionReveal key={tier.name} className="rounded-[28px] border border-white/[0.12] bg-white/[0.045] p-6">
              <div className="flex items-center justify-between">
                <p className="text-xl font-semibold text-white">{tier.name}</p>
                <Cpu className="size-5 text-cyan-200" />
              </div>
              <div className="mt-6 flex items-end gap-2">
                <span className="text-5xl font-semibold text-white">{tier.price}</span>
                <span className="pb-2 text-sm text-slate-400">/property/month</span>
              </div>
              <p className="mt-3 text-sm text-teal-100">{tier.bestFor}</p>
              <div className="mt-6 space-y-3 text-sm text-slate-300">
                <p className="flex items-center gap-2">
                  <Zap className="size-4 text-teal-200" />
                  {tier.cadence}
                </p>
                <p className="flex items-center gap-2">
                  <Zap className="size-4 text-teal-200" />
                  {tier.feature}
                </p>
              </div>
            </SectionReveal>
          ))}
        </div>

        <SectionReveal className="mx-auto mt-8 max-w-4xl rounded-[28px] border border-white/[0.12] bg-white/[0.045] p-5">
          <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-cyan-300 text-slate-950">
              <ShieldCheck className="size-6" />
            </span>
            <div className="grid gap-3 md:grid-cols-3">
              {proofPoints.map((point) => (
                <p key={point} className="flex items-start gap-2 text-sm leading-6 text-slate-300">
                  <CheckCircle2 className="mt-1 size-4 shrink-0 text-teal-200" />
                  {point}
                </p>
              ))}
            </div>
          </div>
        </SectionReveal>

        <div className="mt-10 flex justify-center">
          <Button asChild className="h-14 rounded-full bg-cyan-300 px-8 text-base text-slate-950 hover:bg-cyan-200">
            <Link href={getStartedHref}>
              Start Free - No Credit Card
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
