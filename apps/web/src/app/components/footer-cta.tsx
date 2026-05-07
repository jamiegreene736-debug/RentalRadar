import { ArrowRight, Mail } from "lucide-react";

import { SectionReveal } from "@/app/components/section-reveal";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getStartedHref } from "@/lib/site-config";

export function FooterCta() {
  return (
    <footer className="relative bg-[#070b1a] py-20 sm:py-28">
      <div className="container">
        <SectionReveal className="relative overflow-hidden rounded-[36px] border border-cyan-200/[0.16] bg-gradient-to-br from-cyan-300/[0.12] via-white/[0.045] to-teal-300/[0.08] p-6 shadow-[0_40px_140px_rgba(0,0,0,0.42)] sm:p-10 lg:p-14">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(34,211,238,0.11),transparent)]" />
          <div className="relative grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-100">Ready when you are</p>
              <h2 className="mt-4 max-w-3xl text-balance text-4xl font-semibold tracking-normal text-white sm:text-6xl">
                Price your first property free.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                See current market rates, real booking context, and clear rate recommendations before you publish a single price.
              </p>
            </div>
            <form action={getStartedHref} className="rounded-3xl border border-white/[0.12] bg-slate-950/[0.72] p-4">
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Mail className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@company.com"
                    className="h-14 rounded-full border-white/10 bg-white/[0.04] pl-12 text-white placeholder:text-slate-500"
                  />
                </div>
                <Button type="submit" className="h-14 rounded-full bg-cyan-300 px-7 text-slate-950 hover:bg-cyan-200">
                  Start free
                  <ArrowRight />
                </Button>
              </div>
              <p className="mt-3 px-2 text-xs leading-5 text-slate-500">
                No credit card required for your free property. Rate update tools require your approval before applying rates.
              </p>
            </form>
          </div>
        </SectionReveal>
        <div className="mt-10 flex flex-col justify-between gap-4 border-t border-white/10 pt-8 text-sm text-slate-500 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <BrandLogo markClassName="h-9 w-14" textClassName="text-sm [&>span]:text-sm" />
            <p>© 2026</p>
          </div>
          <p>Live market checks. Clear recommendations. Smarter rates.</p>
        </div>
      </div>
    </footer>
  );
}
