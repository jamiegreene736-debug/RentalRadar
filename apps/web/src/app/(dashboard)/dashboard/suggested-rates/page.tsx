import Link from "next/link";

import { RateForecastResults } from "@/components/rate-forecast-results";
import { getProperties } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function SuggestedRatesPage() {
  const properties = await getProperties();
  const activeProperty = properties[0];

  if (!activeProperty) return <AddPropertyPrompt title="Suggested rates need a saved property" />;

  return <RateForecastResults propertyId={activeProperty.id} view="suggested" />;
}

function AddPropertyPrompt({ title }: { title: string }) {
  return (
    <section className="rounded-lg border border-cyan-900/10 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Suggested Rates</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
        Add a property first, then this page will show the 6, 12, and 24 month rate forecast without the rest of the dashboard stacked underneath it.
      </p>
      <Link href="/dashboard/properties/new" className="mt-5 inline-flex h-11 items-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white">
        Add property
      </Link>
    </section>
  );
}
