import type { Metadata } from "next";
import Link from "next/link";

import { DashboardSidebar, MobileDashboardNav } from "@/app/(dashboard)/components/dashboard-sidebar";
import { RealtimeStatus } from "@/app/(dashboard)/components/realtime-status";
import { BrandLogo } from "@/components/brand-logo";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "RentalRadar logged-in AI pricing dashboard.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="radar-light min-h-screen text-slate-950">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.18),transparent_26%),radial-gradient(circle_at_80%_0%,rgba(45,212,191,0.12),transparent_24%)]" />
      <div className="relative flex">
        <DashboardSidebar />
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b border-cyan-900/10 bg-white/78 backdrop-blur-xl">
            <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <Link href="/dashboard" className="lg:hidden">
                  <BrandLogo showText={false} markClassName="size-10" />
                </Link>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.22em] text-cyan-700">Setup center</p>
                  <p className="truncate text-sm text-slate-600">Add a property to unlock live scans, pricing recommendations, and channel setup.</p>
                </div>
              </div>
              <RealtimeStatus />
            </div>
          </header>
          <div className="px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-8">{children}</div>
        </div>
      </div>
      <MobileDashboardNav />
    </div>
  );
}
