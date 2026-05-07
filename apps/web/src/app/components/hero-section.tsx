import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";

import { AnimatedBrowserDemo } from "@/app/components/animated-browser-demo";
import { DataStreamBackground } from "@/app/components/data-stream-background";
import { Button } from "@/components/ui/button";
import { getStartedHref } from "@/lib/site-config";

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden pt-24">
      <DataStreamBackground />
      <div className="container relative z-10 grid items-center gap-12 pb-16 pt-10 lg:grid-cols-[1fr_0.92fr] lg:pb-24 lg:pt-16">
        <div className="max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/[0.08] px-4 py-2 text-sm text-cyan-100 shadow-[0_0_44px_rgba(34,211,238,0.14)]">
            <span className="size-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.9)]" />
            AI Agents that train Playwright in real headed Chrome
          </div>
          <h1 className="max-w-5xl text-balance text-5xl font-semibold leading-[0.95] tracking-normal text-white sm:text-6xl lg:text-7xl xl:text-8xl">
            The Only Pricing Tool That Finally Gets It
          </h1>
          <p className="mt-7 max-w-3xl text-pretty text-lg leading-8 text-slate-300 sm:text-xl">
            AI agents train Playwright in real headed Chrome to scrape live market rates and auto-push optimized prices
            to Airbnb, VRBO, Booking.com, even without a PMS.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-14 rounded-full bg-cyan-300 px-8 text-base text-slate-950 hover:bg-cyan-200">
              <Link href={getStartedHref}>
                Get Started Free
                <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-14 rounded-full border-white/15 bg-white/5 px-8 text-base text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="#demo">
                <PlayCircle />
                Watch 47-second demo
              </Link>
            </Button>
          </div>
          <div className="mt-9 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-slate-300 backdrop-blur">
            <span className="text-white">Works with</span> Airbnb • VRBO • Booking.com • Hostaway • Streamline • CiiRUS + 20 more
          </div>
        </div>
        <AnimatedBrowserDemo />
      </div>
    </section>
  );
}
