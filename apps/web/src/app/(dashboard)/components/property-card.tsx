import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock, Radio } from "lucide-react";

import { DashboardProperty } from "@/app/(dashboard)/components/dashboard-data";
import { GlassCard } from "@/app/(dashboard)/components/glass-card";
import { cn } from "@/lib/utils";

export function PropertyCard({ property }: { property: DashboardProperty }) {
  return (
    <Link href={`/dashboard/properties/${property.id}`} className="block">
      <GlassCard className="group overflow-hidden">
        <div className="relative h-44">
          <Image src={property.image} alt={property.name} fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-[#050816]/20 to-transparent" />
          <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs text-white backdrop-blur">
            {Math.round(property.confidence * 100)}% confidence
          </div>
          <div className="absolute bottom-4 right-4 grid size-10 place-items-center rounded-full bg-cyan-300 text-slate-950">
            <ArrowUpRight className="size-5" />
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">{property.name}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">{property.address}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">AI rate</p>
              <p className="text-2xl font-semibold text-cyan-100">${property.recommendedRate}</p>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm">
            <span className="flex items-center gap-2 text-slate-300">
              <Clock className="size-4 text-cyan-200" />
              Last scraped {property.lastScrapedMinutes} min ago
            </span>
            <span className="text-emerald-200">+${property.recommendedRate - property.currentRate}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {property.channels.map((channel) => (
              <div key={channel.name} className="rounded-2xl border border-white/10 bg-black/[0.22] px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-300">{channel.name}</span>
                  <Radio className={cn("size-3", channel.status === "live" ? "text-emerald-300" : channel.status === "syncing" ? "text-cyan-200" : "text-amber-200")} />
                </div>
                <p className="mt-1 text-sm font-semibold text-white">${channel.rate}</p>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}
