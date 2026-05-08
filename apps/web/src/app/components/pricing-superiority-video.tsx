import { BrainCircuit, Chrome, Gauge, MousePointerClick, ShieldCheck, Volume2 } from "lucide-react";

import { SectionReveal } from "@/app/components/section-reveal";

const proofPoints = [
  {
    icon: Chrome,
    title: "See the live market",
    copy: "AI agents browse listings exactly the way travelers do, so you know what guests can actually book today.",
  },
  {
    icon: Gauge,
    title: "Blend revenue signals",
    copy: "Every recommendation weighs comp prices with booking pace, occupancy, lead time, and actual revenue.",
  },
  {
    icon: ShieldCheck,
    title: "Explain the move",
    copy: "The system shows which market move and booking signal drove the recommended change.",
  },
  {
    icon: MousePointerClick,
    title: "Push with guardrails",
    copy: "Rate changes stay within your rules and can be pushed to your PMS or host dashboard after approval.",
  },
];

export function PricingSuperiorityVideo() {
  return (
    <section id="demo" className="relative overflow-hidden py-20 sm:py-28">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
      <div className="container">
        <SectionReveal className="mx-auto max-w-4xl text-center">
          <div>
            <p className="flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700">
              <BrainCircuit className="size-4" />
              47-second overview
            </p>
            <h2 className="mx-auto mt-4 max-w-3xl text-balance text-4xl font-semibold tracking-normal text-slate-950 sm:text-6xl">
              Why RentalRadar pricing wins.
            </h2>
          </div>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Better pricing starts with the ultimate evidence: live market checks by AI agents plus your real booking
            performance. The result is smarter rates, higher revenue, and total confidence in every decision.
          </p>
          <div className="mt-6 inline-flex rounded-full border border-cyan-900/10 bg-cyan-50 px-5 py-2 text-sm font-semibold text-cyan-900">
            See -&gt; Decide -&gt; Explain -&gt; Push
          </div>
        </SectionReveal>

        <SectionReveal className="mx-auto mt-10 max-w-6xl overflow-hidden rounded-[24px] border border-cyan-900/15 bg-white/78 shadow-[0_34px_120px_rgba(14,116,144,0.16)]">
          <div className="relative bg-slate-950">
            <video
              className="aspect-video h-full w-full object-cover"
              src="/pricing-superiority-overview.mp4"
              poster="/pricing-superiority-poster.jpg"
              loop
              playsInline
              controls
              preload="metadata"
              aria-label="RentalRadar pricing wins product overview video"
            />
            <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-50 backdrop-blur">
              <Volume2 className="size-4" />
              Sound on
            </div>
          </div>

          <div className="grid gap-0 border-t border-cyan-900/15 bg-white/86 md:grid-cols-4">
            {proofPoints.map((point) => (
              <div key={point.title} className="grid grid-cols-[auto_1fr] gap-4 border-cyan-900/10 p-5 md:border-l md:first:border-l-0">
                <span className="grid size-10 place-items-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-900/10">
                  <point.icon className="size-5" />
                </span>
                <div>
                  <p className="font-semibold text-slate-950">{point.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{point.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
