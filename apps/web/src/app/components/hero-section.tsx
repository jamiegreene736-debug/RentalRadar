import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";

import { AnimatedBrowserDemo } from "@/app/components/animated-browser-demo";
import { DataStreamBackground } from "@/app/components/data-stream-background";
import { Button } from "@/components/ui/button";
import { getStartedHref } from "@/lib/site-config";

export function HeroSection() {
  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] items-start overflow-hidden pt-14">
      <DataStreamBackground />
      <div className="container relative z-10 grid items-start gap-7 pb-6 pt-3 lg:grid-cols-[0.88fr_0.95fr] lg:pb-7 lg:pt-6">
        <div className="max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/[0.08] px-4 py-1.5 text-sm text-cyan-100 shadow-[0_0_44px_rgba(34,211,238,0.14)]">
            <span className="size-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.9)]" />
            Headed Chrome AI agents + real booking data
          </div>
          <h1 className="max-w-4xl text-balance text-4xl font-semibold leading-[1.01] tracking-normal text-white sm:text-5xl lg:text-[3.85rem] xl:text-[4.35rem]">
            The Next Generation of Vacation Rental Pricing Is Here
          </h1>
          <p className="mt-4 max-w-3xl text-pretty text-lg leading-7 text-slate-300 sm:text-[1.2rem]">
            RentalRadar combines AI agents running Playwright in real headed Chrome with booking pace, occupancy, PMS,
            and revenue signals. See what guests see right now, grounded by what properties are really booking for.
          </p>
          <div className="mt-4 grid max-w-3xl gap-3 sm:grid-cols-3">
            {["Playwright + headed Chrome", "Live OTA comp evidence", "Real booking performance"].map((signal) => (
              <div key={signal} className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-2.5 text-sm font-medium text-cyan-50">
                {signal}
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-[52px] rounded-full bg-cyan-300 px-8 text-base text-slate-950 hover:bg-cyan-200">
              <Link href={getStartedHref}>
                Start Free - No Credit Card
                <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-[52px] rounded-full border-white/15 bg-white/5 px-8 text-base text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="#demo">
                <PlayCircle />
                Watch 47-second demo
              </Link>
            </Button>
          </div>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3.5 text-sm text-slate-300 backdrop-blur">
            <span className="text-white">The ultimate combination:</span> live browser evidence, PMS/channel data, booking pace, occupancy, and revenue strategy in one AI pricing engine.
          </div>
        </div>
        <AnimatedBrowserDemo />
      </div>
    </section>
  );
}
