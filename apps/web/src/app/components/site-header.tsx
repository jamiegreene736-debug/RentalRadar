import Link from "next/link";
import { ArrowRight, LogIn } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { signInPath } from "@/lib/auth-config";
import { getStartedHref } from "@/lib/site-config";

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#050816]/[0.72] backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <BrandLogo markClassName="size-9" textClassName="hidden sm:block" />
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
          <a href="#how-it-works" className="transition hover:text-cyan-200">
            How it works
          </a>
          <a href="#extensions" className="transition hover:text-cyan-200">
            Extensions
          </a>
          <a href="#forecast-intelligence" className="transition hover:text-cyan-200">
            Features
          </a>
          <a href="#pricing" className="transition hover:text-cyan-200">
            Pricing
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="hidden h-10 rounded-full px-4 text-slate-200 hover:bg-white/10 hover:text-white sm:inline-flex">
            <Link href={signInPath}>
              <LogIn />
              Sign In
            </Link>
          </Button>
          <Button asChild className="h-10 rounded-full bg-cyan-300 px-5 text-slate-950 hover:bg-cyan-200">
            <Link href={getStartedHref}>
              Start Free
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
