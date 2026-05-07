import type { Metadata } from "next";

import { DashboardSidebar, MobileDashboardNav } from "@/app/(dashboard)/components/dashboard-sidebar";
import { RealtimeStatus } from "@/app/(dashboard)/components/realtime-status";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "RentalRadar logged-in AI pricing dashboard.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050816] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.12),transparent_26%),radial-gradient(circle_at_80%_0%,rgba(45,212,191,0.1),transparent_24%)]" />
      <div className="relative flex">
        <DashboardSidebar />
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050816]/72 backdrop-blur-xl">
            <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">Command center</p>
                <p className="text-sm text-slate-400">Live scraping, AI pricing, PMS sync, and browser extension control.</p>
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
