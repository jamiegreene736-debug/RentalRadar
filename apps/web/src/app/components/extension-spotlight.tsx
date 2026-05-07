import Link from "next/link";
import { ArrowRight, Chrome, Compass, MonitorUp, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { SectionReveal } from "@/app/components/section-reveal";
import { Button } from "@/components/ui/button";

export function ExtensionSpotlight() {
  return (
    <section id="extensions" className="relative overflow-hidden bg-[#050816] py-24 sm:py-32">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
      <div className="container grid items-center gap-12 lg:grid-cols-[0.95fr_1fr]">
        <SectionReveal>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-200">Rate update tools</p>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-normal text-white sm:text-6xl">
            Update approved rates, even without a PMS.
          </h2>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            If your team is not connected to a property management system yet, RentalRadar can still help you apply approved rates in the host dashboards you already use.
          </p>
          <p className="mt-4 text-lg leading-8 text-cyan-100">
            You stay in control: review the recommendation first, approve it, then apply the update when you are ready.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-12 rounded-full bg-white px-6 text-slate-950 hover:bg-cyan-100">
              <Link href="/extension/chrome">
                <Chrome />
                Install Chrome
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 rounded-full border-white/15 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/extension/safari">
                <Compass />
                Install Safari
              </Link>
            </Button>
          </div>
        </SectionReveal>

        <SectionReveal className="relative">
          <div className="absolute -inset-8 rounded-[36px] bg-cyan-300/10 blur-3xl" />
          <div className="relative rounded-[32px] border border-white/[0.12] bg-white/[0.05] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.4)]">
            <div className="grid gap-4 sm:grid-cols-2">
              <StoreBadge icon={Chrome} title="Chrome Web Store" copy="Install in 30 seconds" />
              <StoreBadge icon={Compass} title="Safari Extensions" copy="Native macOS workflow" />
            </div>
            <div className="mt-6 rounded-3xl border border-cyan-200/[0.14] bg-slate-950 p-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-sm text-slate-400">RentalRadar Extension</p>
                  <p className="text-xl font-semibold text-white">3 approved nights ready</p>
                </div>
                <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">ready to review</span>
              </div>
              <div className="mt-5 space-y-3">
                {[
                  ["Fri Jun 12", "$312", "2-night min"],
                  ["Sat Jun 13", "$329", "2-night min"],
                  ["Sun Jun 14", "$246", "5% gap fill"],
                ].map(([date, rate, rule]) => (
                  <div key={date} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm">
                    <span className="text-slate-300">{date}</span>
                    <span className="font-semibold text-white">{rate}</span>
                    <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">{rule}</span>
                  </div>
                ))}
              </div>
              <button className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-cyan-300 text-sm font-semibold text-slate-950 shadow-[0_0_40px_rgba(34,211,238,0.25)]">
                Apply Now
                <ArrowRight className="size-4" />
              </button>
            </div>
            <div className="mt-5 flex items-center gap-3 text-sm text-slate-300">
              <ShieldCheck className="size-5 text-teal-200" />
              RentalRadar never asks for or stores your channel passwords here. You approve every rate update.
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}

function StoreBadge({ icon: Icon, title, copy }: { icon: LucideIcon; title: string; copy: string }) {
  return (
    <div className="rounded-3xl border border-white/[0.12] bg-black/[0.28] p-5">
      <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-white text-slate-950">
        <Icon className="size-6" />
      </div>
      <p className="text-lg font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm text-slate-400">{copy}</p>
      <div className="mt-5 flex items-center gap-2 text-sm text-cyan-100">
        <MonitorUp className="size-4" />
        Host dashboard ready
      </div>
    </div>
  );
}
