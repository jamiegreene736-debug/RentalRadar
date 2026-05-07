import Image from "next/image";
import Link from "next/link";
import { MapPin, Search } from "lucide-react";

import { properties } from "@/app/(dashboard)/components/dashboard-data";
import { GlassCard, PanelTitle } from "@/app/(dashboard)/components/glass-card";
import { PropertyTabs } from "@/app/(dashboard)/components/property-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const property = properties.find((item) => item.id === id);

  if (!property) {
    return (
      <div className="grid gap-6">
        <GlassCard className="p-6">
          <PanelTitle
            eyebrow="Property Detail"
            title="Add a property to unlock this page"
            copy="The sample property has been removed. Enter a real address first, then this page will show live market data for that property."
          />
          <Button asChild className="mt-6 h-12 rounded-full bg-cyan-300 px-6 text-slate-950 hover:bg-cyan-200">
            <Link href="/dashboard/properties/new">Add property address</Link>
          </Button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-700">Property Detail</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">{property.name}</h1>
          <p className="mt-3 flex items-center gap-2 text-slate-600">
            <MapPin className="size-4 text-cyan-800" />
            {property.address}
          </p>
          <div className="relative mt-6 max-w-2xl">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Search another address or property"
              className="h-14 rounded-full border-cyan-900/10 bg-white/80 pl-12 text-slate-950 placeholder:text-slate-500"
            />
          </div>
        </div>
        <GlassCard className="overflow-hidden">
          <div className="relative h-64">
            <Image src={property.image} alt={property.name} fill sizes="420px" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 to-transparent" />
            <div className="absolute bottom-4 left-4">
              <p className="text-sm text-slate-300">AI recommended</p>
              <p className="text-4xl font-semibold text-white">${property.recommendedRate}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-5">
        <PanelTitle eyebrow="Map" title="Local market center" copy="Google Maps embed-ready container for address geocoding and nearby comp discovery." />
        <div className="map-grid mt-5 grid h-72 place-items-center rounded-3xl border border-cyan-200/20 bg-cyan-300/10 text-center">
          <div>
            <MapPin className="mx-auto mb-3 size-8 text-cyan-800" />
            <p className="font-semibold text-slate-950">{property.address}</p>
            <p className="mt-1 text-sm text-slate-600">Google Maps embed key plugs in here.</p>
          </div>
        </div>
      </GlassCard>

      <PropertyTabs />
    </div>
  );
}
