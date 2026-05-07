import Link from "next/link";
import { ArrowRight, Cpu, Zap } from "lucide-react";

import { SectionReveal } from "@/app/components/section-reveal";
import { Button } from "@/components/ui/button";

const signUpHref = process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? "/sign-up";

const tiers = [
  ["Starter", "$3", "Daily scans", "Rate intelligence"],
  ["Growth", "$6", "4x daily scans", "PMS push"],
  ["Pro", "$9", "Hourly scans", "Extension + PMS"],
];

export function PricingTeaser() {
  return (
    <section id="pricing" className="relative overflow-hidden bg-[#050816] py-24 sm:py-32">
      <div className="absolute left-1/2 top-0 h-px w-[80vw] -translate-x-1/2 bg-gradient-to-r from-transparent via-teal-300/50 to-transparent" />
      <div className="container">
        <SectionReveal className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-200">Ultra-low pricing</p>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-normal text-white sm:text-6xl">
            Just $3-$9 per property/month, compute included.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            Built to be dramatically cheaper because your data pipeline is adaptive, automated, and self-healing.
          </p>
        </SectionReveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {tiers.map(([name, price, scans, feature]) => (
            <SectionReveal key={name} className="rounded-[28px] border border-white/[0.12] bg-white/[0.045] p-6">
              <div className="flex items-center justify-between">
                <p className="text-xl font-semibold text-white">{name}</p>
                <Cpu className="size-5 text-cyan-200" />
              </div>
              <div className="mt-6 flex items-end gap-2">
                <span className="text-5xl font-semibold text-white">{price}</span>
                <span className="pb-2 text-sm text-slate-400">/property/month</span>
              </div>
              <div className="mt-6 space-y-3 text-sm text-slate-300">
                <p className="flex items-center gap-2">
                  <Zap className="size-4 text-teal-200" />
                  {scans}
                </p>
                <p className="flex items-center gap-2">
                  <Zap className="size-4 text-teal-200" />
                  {feature}
                </p>
              </div>
            </SectionReveal>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Button asChild className="h-14 rounded-full bg-cyan-300 px-8 text-base text-slate-950 hover:bg-cyan-200">
            <Link href={signUpHref}>
              Start with 1 free property
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
