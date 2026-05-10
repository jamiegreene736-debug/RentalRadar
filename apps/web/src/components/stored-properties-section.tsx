"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Building2, Chrome, ExternalLink, LoaderCircle, MapPin, RotateCw } from "lucide-react";

import { rerunPropertyScanAction } from "@/app/actions";
import { PropertyResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const initialState = { ok: false, message: "" };

type StoredPropertiesSectionProps = {
  properties: PropertyResponse[];
  compact?: boolean;
};

export function StoredPropertiesSection({ properties, compact = false }: StoredPropertiesSectionProps) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-cyan-900/10 bg-white/88 shadow-[0_24px_90px_rgba(14,116,144,0.13)]",
        compact ? "p-4" : "p-5",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-700">Stored Properties</p>
          <h2 className={cn("mt-2 font-semibold tracking-normal text-slate-950", compact ? "text-xl" : "text-2xl")}>
            Saved addresses you can scan again
          </h2>
          <p className={cn("mt-2 max-w-3xl text-sm text-slate-600", compact ? "leading-5" : "leading-6")}>
            {compact
              ? "Use the saved property record below to scan again without creating a duplicate."
              : "If RentalRadar says an address already exists, it will show up here. Use these saved records to rerun browser searches, open the detail page, and review scan history."}
          </p>
        </div>
        <Link
          href="/dashboard/properties/new"
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-cyan-900/10 bg-white px-4 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-50"
        >
          <Building2 className="size-4" />
          Add another
        </Link>
      </div>

      <div className="mt-5 grid gap-3">
        {properties.length ? (
          properties.map((property) => <StoredPropertyRow key={property.id} property={property} compact={compact} />)
        ) : (
          <div className="rounded-2xl border border-dashed border-cyan-900/20 bg-cyan-50/40 p-5 text-sm leading-6 text-slate-600">
            No stored properties yet. Search an address above and the saved property record will appear here after it is created.
          </div>
        )}
      </div>
    </section>
  );
}

function StoredPropertyRow({ property, compact = false }: { property: PropertyResponse; compact?: boolean }) {
  const [state, action, pending] = useActionState(rerunPropertyScanAction, initialState);
  const label = property.name || property.formatted_address || property.address_line1;
  const details = [
    property.bedrooms != null ? `${property.bedrooms} bed${property.bedrooms === 1 ? "" : "s"}` : null,
    property.bathrooms != null ? `${property.bathrooms} bath${property.bathrooms === 1 ? "" : "s"}` : null,
    property.sleeps != null ? `Sleeps ${property.sleeps}` : null,
  ].filter(Boolean);

  return (
    <div className={cn("rounded-3xl border border-cyan-900/10 bg-white shadow-[0_14px_45px_rgba(15,23,42,0.06)]", compact ? "p-3" : "p-4")}>
      <div className={cn("flex flex-col", compact ? "gap-3" : "gap-4 xl:flex-row xl:items-center xl:justify-between")}>
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span className={cn("mt-0.5 grid shrink-0 place-items-center rounded-2xl bg-cyan-100 text-cyan-800", compact ? "size-9" : "size-10")}>
              <MapPin className={compact ? "size-4" : "size-5"} />
            </span>
            <div className="min-w-0">
              <p className={cn("truncate font-semibold text-slate-950", compact ? "text-base" : "text-lg")}>{label}</p>
              <p className={cn("mt-1 text-sm text-slate-600", compact ? "line-clamp-2 leading-5" : "leading-6")}>
                {property.formatted_address || property.address_line1}
                {details.length ? ` · ${details.join(" · ")}` : ""}
              </p>
            </div>
          </div>
          {state.message ? (
            <p className={state.ok ? "mt-3 text-sm text-emerald-700" : "mt-3 text-sm text-rose-700"}>{state.message}</p>
          ) : null}
        </div>

        <div className={cn("flex flex-wrap gap-2", compact ? "items-center" : null)}>
          <form action={action}>
            <input type="hidden" name="propertyId" value={property.id} />
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-cyan-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
              Scan saved property
            </button>
          </form>
          <Link
            href={`/dashboard/properties/${property.id}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-900/10 bg-white px-4 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-50"
          >
            <ExternalLink className="size-4" />
            Detail
          </Link>
          <Link
            href="/dashboard/ai-log"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-900/10 bg-cyan-50 px-4 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-100"
          >
            <Chrome className="size-4" />
            History
          </Link>
        </div>
      </div>
    </div>
  );
}
