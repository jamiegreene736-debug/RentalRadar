import Link from "next/link";

import { RateForecastResults } from "@/components/rate-forecast-results";
import { getProperties } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function MarketEvidencePage() {
  const properties = await getProperties();
  const activeProperty = properties[0];

  if (!activeProperty) return <AddPropertyPrompt />;

  return <RateForecastResults propertyId={activeProperty.id} view="market" />;
}

function AddPropertyPrompt() {
  return (
    <section className="rounded-lg border border-cyan-900/10 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Market Evidence</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-950">Market evidence needs a saved property</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
        Add a property first, then this page will show OTA source coverage, clean samples, market median, market average, and the base-rate model.
      </p>
      <Link href="/dashboard/properties/new" className="mt-5 inline-flex h-11 items-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white">
        Add property
      </Link>
    </section>
  );
}
