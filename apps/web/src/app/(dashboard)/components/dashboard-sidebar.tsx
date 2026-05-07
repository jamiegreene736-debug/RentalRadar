"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, Bot, Building2, ChevronLeft, LayoutDashboard, PlugZap, Radar, Settings } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/properties/oceanview-miami", label: "Property Detail", icon: Building2 },
  { href: "/dashboard/connections", label: "Connections", icon: PlugZap },
  { href: "/dashboard/ai-log", label: "AI Scraping Log", icon: Bot },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 88 : 280 }}
      className="sticky top-0 hidden h-screen shrink-0 border-r border-white/10 bg-[#050816]/88 px-4 py-5 backdrop-blur-xl lg:block"
    >
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100 shadow-[0_0_34px_rgba(34,211,238,0.2)]">
            <Radar className="size-5" />
          </span>
          {!collapsed ? (
            <span>
              <span className="block text-sm font-semibold text-white">RentalRadar.ai</span>
              <span className="text-xs text-slate-500">AI pricing ops</span>
            </span>
          ) : null}
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400 transition hover:text-cyan-100"
          aria-label="Toggle sidebar"
        >
          <ChevronLeft className={cn("size-4 transition", collapsed && "rotate-180")} />
        </button>
      </div>

      <nav className="mt-10 space-y-2">
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-12 items-center gap-3 rounded-2xl px-4 text-sm transition",
                active
                  ? "bg-cyan-300 text-slate-950 shadow-[0_0_34px_rgba(34,211,238,0.22)]"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-white",
              )}
            >
              <item.icon className="size-5 shrink-0" />
              {!collapsed ? <span>{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-5 left-4 right-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-200">
            <Activity className="size-5" />
          </span>
          {!collapsed ? (
            <div>
              <p className="text-sm font-medium text-white">Browser farm live</p>
              <p className="text-xs text-slate-500">8 headed Chrome sessions</p>
            </div>
          ) : null}
        </div>
        {!collapsed ? (
          <Link href="/dashboard/settings" className="mt-4 flex items-center gap-2 text-xs text-slate-500 hover:text-cyan-100">
            <Settings className="size-3.5" />
            Settings
          </Link>
        ) : null}
      </div>
    </motion.aside>
  );
}

export function MobileDashboardNav() {
  const pathname = usePathname();
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 rounded-3xl border border-white/10 bg-[#050816]/90 p-2 shadow-[0_20px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:hidden">
      {nav.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn("grid place-items-center rounded-2xl py-2 text-xs", active ? "bg-cyan-300 text-slate-950" : "text-slate-400")}
          >
            <item.icon className="mb-1 size-4" />
            {item.label.split(" ")[0]}
          </Link>
        );
      })}
    </div>
  );
}
