import Link from "next/link";
import { Activity, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

const signUpHref = process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? "/sign-up";

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#050816]/[0.72] backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 shadow-[0_0_28px_rgba(34,211,238,0.28)]">
            <Activity className="size-5 text-cyan-200" />
          </span>
          <span className="text-base font-semibold tracking-wide text-white">RentalRadar.ai</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
          <a href="#how-it-works" className="transition hover:text-cyan-200">
            How it works
          </a>
          <a href="#extensions" className="transition hover:text-cyan-200">
            Extensions
          </a>
          <a href="#comparison" className="transition hover:text-cyan-200">
            Compare
          </a>
          <a href="#pricing" className="transition hover:text-cyan-200">
            Pricing
          </a>
        </nav>
        <Button asChild className="h-10 rounded-full bg-cyan-300 px-5 text-slate-950 hover:bg-cyan-200">
          <Link href={signUpHref}>
            Get Started
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </header>
  );
}
