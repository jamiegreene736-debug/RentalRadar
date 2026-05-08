"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarRange, CircleDollarSign, LoaderCircle, Percent, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { RateForecastResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const horizons = [6, 12, 24] as const;

export function RateForecastResults({ propertyId }: { propertyId?: string }) {
  const [months, setMonths] = useState<(typeof horizons)[number]>(6);
  const [forecast, setForecast] = useState<RateForecastResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (!propertyId) {
      setForecast(null);
      setStatus("idle");
      return;
    }

    let cancelled = false;
    async function loadForecast() {
      try {
        setStatus("loading");
        const response = await fetch(`/api/backend/properties/${propertyId}/rate-forecast?months=${months}`, {
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Forecast failed: ${response.status}`);
        const payload = (await response.json()) as RateForecastResponse;
        if (!cancelled) {
          setForecast(payload);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void loadForecast();
    return () => {
      cancelled = true;
    };
  }, [months, propertyId]);

  const monthly = forecast?.monthly ?? [];
  const maxRevenue = Math.max(...monthly.map((month) => month.estimated_revenue_cents), 1);
  const firstNights = forecast?.nights.slice(0, 14) ?? [];
  const averageRate = useMemo(() => {
    if (!forecast?.nights.length) return 0;
    return Math.round(
      forecast.nights.reduce((sum, night) => sum + night.recommended_rate_cents, 0) / forecast.nights.length,
    );
  }, [forecast]);

  if (!propertyId) return null;

  return (
    <section className="mt-5 rounded-[24px] border border-cyan-900/10 bg-white p-5 shadow-[0_28px_90px_rgba(14,116,144,0.12)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Suggested Rates</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">Forecasted revenue and occupancy</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {forecast?.address ?? "RentalRadar is preparing a forward rate forecast for this property."}
          </p>
        </div>
        <div className="flex rounded-2xl border border-cyan-900/10 bg-slate-50 p-1">
          {horizons.map((horizon) => (
            <button
              key={horizon}
              type="button"
              onClick={() => setMonths(horizon)}
              className={cn(
                "h-10 rounded-xl px-4 text-sm font-medium transition",
                months === horizon ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white",
              )}
            >
              {horizon} mo
            </button>
          ))}
        </div>
      </div>

      {status === "loading" ? (
        <div className="mt-6 grid min-h-64 place-items-center rounded-2xl border border-cyan-900/10 bg-slate-50 text-slate-600">
          <div className="text-center">
            <LoaderCircle className="mx-auto size-8 animate-spin text-cyan-700" />
            <p className="mt-3 text-sm font-medium">Building the {months}-month forecast</p>
          </div>
        </div>
      ) : status === "error" ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Unable to load the forecast yet. The scrape can continue running while RentalRadar retries.
        </div>
      ) : forecast ? (
        <>
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <Metric icon={CircleDollarSign} label="RentalRadar revenue" value={money(forecast.recommended_total_revenue_cents)} />
            <Metric icon={TrendingUp} label="Projected lift" value={money(forecast.extra_income_vs_beyond_cents)} />
            <Metric icon={Percent} label="Estimated occupancy" value={percent(forecast.estimated_occupancy)} />
            <Metric icon={CalendarRange} label="Average nightly rate" value={money(averageRate)} />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
            <div className="rounded-2xl border border-cyan-900/10 bg-slate-950 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-white">
                  <BarChart3 className="size-4 text-cyan-200" />
                  <p className="text-sm font-semibold">Monthly revenue outlook</p>
                </div>
                <p className="text-xs text-slate-400">RentalRadar against market benchmark</p>
              </div>
              <div className="space-y-3">
                {monthly.map((month) => (
                  <div key={month.month} className="grid gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-200">{monthLabel(month.month)}</span>
                      <span className="text-cyan-100">{money(month.estimated_revenue_cents)}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-cyan-300"
                        style={{ width: `${Math.max(8, (month.estimated_revenue_cents / maxRevenue) * 100)}%` }}
                      />
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-amber-300/80"
                        style={{ width: `${Math.max(8, (month.beyond_pricing_revenue_cents / maxRevenue) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-cyan-900/10 bg-slate-50">
              <div className="grid grid-cols-4 border-b border-cyan-900/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <span>Date</span>
                <span>Rate</span>
                <span>Occ.</span>
                <span>Market</span>
              </div>
              {firstNights.map((night) => (
                <div key={night.stay_date} className="grid grid-cols-4 border-b border-cyan-900/5 px-4 py-3 text-sm last:border-b-0">
                  <span className="text-slate-600">{shortDate(night.stay_date)}</span>
                  <span className="font-semibold text-slate-950">{money(night.recommended_rate_cents)}</span>
                  <span className="text-cyan-700">{percent(night.estimated_occupancy)}</span>
                  <span className="text-slate-500">{money(night.beyond_pricing_rate_cents)}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">{forecast.explanation}</p>
        </>
      ) : null}
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-cyan-900/10 bg-slate-50 p-4">
      <Icon className="size-5 text-cyan-700" />
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{label}</p>
    </div>
  );
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}
