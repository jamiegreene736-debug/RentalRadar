"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarRange,
  CheckCircle2,
  CircleDollarSign,
  Database,
  Gauge,
  Layers3,
  LoaderCircle,
  Percent,
  RefreshCw,
  RadioTower,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { MarketSourceEvidence, PricingAdjustmentLayer, RateForecastResponse, SourceCheckResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const horizons = [6, 12, 24] as const;
type ForecastView = "full" | "suggested" | "stack" | "market";

export function RateForecastResults({ propertyId, view = "full" }: { propertyId?: string; view?: ForecastView }) {
  const [months, setMonths] = useState<(typeof horizons)[number]>(6);
  const [forecast, setForecast] = useState<RateForecastResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [sourceCheck, setSourceCheck] = useState<{
    status: "idle" | "checking" | "ready" | "error";
    message?: string;
    result?: SourceCheckResponse;
  }>({ status: "idle" });
  const showMarket = view === "full" || view === "market";
  const showStack = view === "full" || view === "stack";
  const showSuggested = view === "full" || view === "suggested";

  const loadForecast = useCallback(async () => {
    if (!propertyId) {
      setForecast(null);
      setStatus("idle");
      return;
    }

    setStatus("loading");
    const response = await fetch(`/api/backend/properties/${propertyId}/rate-forecast?months=${months}`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Forecast failed: ${response.status}`);
    const payload = (await response.json()) as RateForecastResponse;
    setForecast(payload);
    setStatus("ready");
  }, [months, propertyId]);

  useEffect(() => {
    if (!propertyId) {
      setForecast(null);
      setStatus("idle");
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        await loadForecast();
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [loadForecast, propertyId]);

  const monthly = forecast?.monthly ?? [];
  const maxRevenue = Math.max(
    ...monthly.map((month) => Math.max(month.estimated_revenue_cents, month.market_benchmark_revenue_cents)),
    1,
  );
  const firstNights = forecast?.nights.slice(0, 14) ?? [];
  const averageRate = useMemo(() => {
    if (!forecast?.nights.length) return 0;
    return Math.round(
      forecast.nights.reduce((sum, night) => sum + night.recommended_rate_cents, 0) / forecast.nights.length,
    );
  }, [forecast]);

  async function checkAllSources() {
    if (!propertyId) return;
    try {
      setSourceCheck({ status: "checking", message: "Checking OTA scans and live demand APIs..." });
      const response = await fetch(`/api/backend/properties/${propertyId}/source-check?months=${months}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Source check failed: ${response.status}`);
      const result = (await response.json()) as SourceCheckResponse;
      setSourceCheck({ status: "ready", message: result.message, result });
      await loadForecast();
    } catch {
      setSourceCheck({
        status: "error",
        message: "Unable to check every source right now. The existing scan queue can keep running while you retry.",
      });
    }
  }

  if (!propertyId) return null;

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">{forecastTitle(view).eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">{forecastTitle(view).title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {forecast?.address ??
              "RentalRadar is preparing the market evidence, base-rate model, and rate adjustment stack for this property."}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={checkAllSources}
            disabled={sourceCheck.status === "checking"}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <RefreshCw className={cn("size-4", sourceCheck.status === "checking" ? "animate-spin" : "")} />
            Check all sources
          </button>
          <div className="flex rounded-lg border border-cyan-900/10 bg-white p-1 shadow-sm">
            {horizons.map((horizon) => (
              <button
                key={horizon}
                type="button"
                onClick={() => setMonths(horizon)}
                className={cn(
                  "h-10 rounded-md px-4 text-sm font-medium transition",
                  months === horizon ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white",
                )}
              >
                {horizon} mo
              </button>
            ))}
          </div>
        </div>
      </div>

      {status === "loading" ? (
        <div className="grid min-h-64 place-items-center rounded-lg border border-cyan-900/10 bg-white text-slate-600 shadow-sm">
          <div className="text-center">
            <LoaderCircle className="mx-auto size-8 animate-spin text-cyan-700" />
            <p className="mt-3 text-sm font-medium">Building the {months}-month forecast</p>
          </div>
        </div>
      ) : status === "error" ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Unable to load the forecast yet. The scrape can continue running while RentalRadar retries.
        </div>
      ) : forecast ? (
        <>
          {showSuggested ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
            <Metric icon={CircleDollarSign} label="24-month base ADR" value={money(forecast.base_rate_model.base_rate_cents)} />
            <Metric icon={Database} label="Market samples" value={`${forecast.base_rate_model.source_count}/3 sources`} />
            <Metric icon={Percent} label="Estimated occupancy" value={percent(forecast.estimated_occupancy)} />
            <Metric icon={TrendingUp} label="Projected lift" value={money(forecast.extra_income_vs_market_cents)} />
            </div>
          ) : null}

          {showSuggested ? (
            <SourceCoveragePanel forecast={forecast} sourceCheck={sourceCheck} />
          ) : null}

          {showMarket ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
            <Panel>
              <PanelHeader
                icon={Database}
                eyebrow="AI agent market evidence"
                title="Visible OTA rates by source"
                aside={`${forecast.base_rate_model.sample_size} clean samples`}
              />
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {forecast.market_sources.map((source) => (
                  <SourceEvidence key={source.source} source={source} />
                ))}
              </div>
            </Panel>

            <Panel>
              <PanelHeader icon={Gauge} eyebrow="Base rate" title={forecast.base_rate_model.method} aside={money(forecast.base_rate_model.base_rate_cents)} />
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MiniStat label="Median" value={optionalMoney(forecast.base_rate_model.market_median_rate_cents)} />
                <MiniStat label="Average" value={optionalMoney(forecast.base_rate_model.market_average_rate_cents)} />
                <MiniStat label="Horizon" value={`${forecast.months} mo`} />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{forecast.base_rate_model.explanation}</p>
              <div className="mt-4 rounded-lg border border-cyan-900/10 bg-cyan-50/70 p-3 text-sm leading-6 text-cyan-950">
                <span className="font-semibold">Booked-rate feed needed:</span> {forecast.base_rate_model.booked_rate_feed}
              </div>
            </Panel>
            </div>
          ) : null}

          <div className={cn("grid gap-4", showStack && showSuggested ? "2xl:grid-cols-[minmax(0,1fr)_minmax(440px,0.82fr)]" : "")}>
            {showStack ? (
            <Panel>
              <PanelHeader
                icon={Layers3}
                eyebrow="Rate stack"
                title="How the base rate becomes the nightly rate"
                aside={money(averageRate)}
              />
              <div className="mt-4 grid gap-3">
                {forecast.adjustment_layers.map((layer) => (
                  <PricingLayerRow key={layer.code} layer={layer} baseRate={forecast.base_rate_model.base_rate_cents} />
                ))}
              </div>
            </Panel>
            ) : null}

            {showSuggested ? (
            <Panel className="bg-slate-950 text-white">
              <PanelHeader
                icon={BarChart3}
                eyebrow="24-month outlook"
                title="Monthly ADR, occupancy, and revenue"
                aside="RR vs market"
                dark
              />
              <div className="mt-4 space-y-3">
                {monthly.map((month) => (
                  <div key={month.month} className="grid gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-100">{monthLabel(month.month)}</span>
                      <span className="text-cyan-100">
                        {money(month.average_recommended_rate_cents)} / {percent(month.estimated_occupancy)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-cyan-300"
                        style={{ width: `${Math.max(8, (month.estimated_revenue_cents / maxRevenue) * 100)}%` }}
                      />
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-emerald-300/75"
                        style={{ width: `${Math.max(8, (month.market_benchmark_revenue_cents / maxRevenue) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
            ) : null}
          </div>

          {showSuggested ? (
          <Panel>
            <PanelHeader icon={CalendarRange} eyebrow="First two weeks" title="Nightly rates after all layers" aside={forecast.explanation} />
            <div className="mt-4 overflow-x-auto">
              <div className="min-w-[700px]">
                <div className="grid grid-cols-[1fr_0.8fr_0.8fr_0.8fr_1fr] border-b border-cyan-900/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <span>Date</span>
                  <span>Final rate</span>
                  <span>Base market</span>
                  <span>Occ.</span>
                  <span>Model read</span>
                </div>
                {firstNights.map((night) => {
                  const spread = (night.recommended_rate_cents - forecast.base_rate_model.base_rate_cents) / Math.max(forecast.base_rate_model.base_rate_cents, 1);
                  return (
                    <div
                      key={night.stay_date}
                      className="grid grid-cols-[1fr_0.8fr_0.8fr_0.8fr_1fr] border-b border-cyan-900/5 px-3 py-3 text-sm last:border-b-0"
                    >
                      <span className="text-slate-600">{shortDate(night.stay_date)}</span>
                      <span className="font-semibold text-slate-950">{money(night.recommended_rate_cents)}</span>
                      <span className="text-slate-500">{money(forecast.base_rate_model.base_rate_cents)}</span>
                      <span className="text-cyan-700">{percent(night.estimated_occupancy)}</span>
                      <span className={cn("font-medium", spread >= 0 ? "text-emerald-700" : "text-rose-700")}>
                        {spread >= 0 ? "+" : ""}
                        {percent(spread)} vs base
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function forecastTitle(view: ForecastView) {
  if (view === "stack") return { eyebrow: "Rate Stack", title: "How the nightly rate is built" };
  if (view === "market") return { eyebrow: "Market Evidence", title: "Live OTA evidence and base-rate model" };
  return { eyebrow: "Suggested Rates", title: "AI market pricing model" };
}

function SourceCoveragePanel({
  forecast,
  sourceCheck,
}: {
  forecast: RateForecastResponse;
  sourceCheck: {
    status: "idle" | "checking" | "ready" | "error";
    message?: string;
    result?: SourceCheckResponse;
  };
}) {
  const liveOtaCount = forecast.market_sources.filter((source) => source.sample_count > 0).length;
  const demandLayers = forecast.adjustment_layers.filter((layer) => ["area_event", "weather", "flight"].includes(layer.code));
  const activeApiCount = demandLayers.filter((layer) => layer.status === "active" || layer.status === "manual_active").length;
  const checkResult = sourceCheck.result;
  return (
    <Panel>
      <PanelHeader
        icon={RadioTower}
        eyebrow="Source check"
        title="OTA scans and live demand APIs"
        aside={
          sourceCheck.status === "checking"
            ? "Checking now"
            : `OTA ${liveOtaCount}/3 live · API ${activeApiCount}/3 active`
        }
      />
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-950">OTA browser scans</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {forecast.market_sources.map((source) => (
              <SourceChip
                key={source.source}
                label={source.label}
                active={source.sample_count > 0}
                detail={source.sample_count > 0 ? `${source.sample_count} samples` : "Queued or waiting"}
              />
            ))}
          </div>
          <p className="text-xs leading-5 text-slate-500">
            The button queues headed browser checks for Airbnb, VRBO, and Booking.com across the selected forecast window.
          </p>
        </div>
        <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-950">API demand data</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {demandLayers.map((layer) => (
              <SourceChip
                key={layer.code}
                label={layer.label}
                active={layer.status === "active" || layer.status === "manual_active"}
                detail={apiLayerDetail(layer, checkResult)}
              />
            ))}
          </div>
          <p className="text-xs leading-5 text-slate-500">
            This includes weather, nearby events, and flight pressure when provider keys are available.
          </p>
        </div>
      </div>
      {sourceCheck.message ? (
        <p
          className={cn(
            "mt-3 rounded-lg border p-3 text-sm leading-6",
            sourceCheck.status === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-cyan-900/10 bg-cyan-50/70 text-cyan-950",
          )}
        >
          {sourceCheck.message}
          {checkResult?.queued_job_ids.length ? ` ${checkResult.queued_job_ids.length} browser scan${checkResult.queued_job_ids.length === 1 ? "" : "s"} queued.` : ""}
          {typeof checkResult?.demand_signal_count === "number" ? ` ${checkResult.demand_signal_count} API signal${checkResult.demand_signal_count === 1 ? "" : "s"} refreshed.` : ""}
        </p>
      ) : null}
    </Panel>
  );
}

function SourceChip({ label, active, detail }: { label: string; active: boolean; detail: string }) {
  return (
    <div className="rounded-lg border border-white bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <CheckCircle2 className={cn("size-4", active ? "text-emerald-600" : "text-slate-300")} />
        <p className="min-w-0 truncate text-sm font-semibold text-slate-950">{label}</p>
      </div>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function apiLayerDetail(layer: PricingAdjustmentLayer, result?: SourceCheckResponse) {
  const providerKey = layer.code === "area_event" ? "events" : layer.code === "flight" ? "flights" : layer.code;
  const provider = result?.providers?.[providerKey];
  if (provider?.status === "missing_key") return "Needs API key";
  if (provider?.status === "disabled") return "Needs provider";
  if (provider?.status === "succeeded") return `${provider.created_count ?? 0} signals`;
  if (layer.status === "active" || layer.status === "manual_active") return signedPercent(layer.adjustment_percent);
  if (layer.status === "awaiting_feed") return "Waiting for feed";
  return statusLabel(layer.status);
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-cyan-900/10 bg-white p-4 shadow-sm">
      <Icon className="size-5 text-cyan-700" />
      <p className="mt-3 break-words text-2xl font-semibold leading-tight text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{label}</p>
    </div>
  );
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-lg border border-cyan-900/10 bg-white p-4 shadow-sm", className)}>{children}</div>;
}

function PanelHeader({
  icon: Icon,
  eyebrow,
  title,
  aside,
  dark,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  aside?: string;
  dark?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg",
            dark ? "bg-white/10 text-cyan-200" : "bg-cyan-50 text-cyan-700",
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className={cn("text-xs font-semibold uppercase tracking-[0.16em]", dark ? "text-cyan-200" : "text-cyan-700")}>{eyebrow}</p>
          <h3 className={cn("mt-1 text-lg font-semibold leading-tight", dark ? "text-white" : "text-slate-950")}>{title}</h3>
        </div>
      </div>
      {aside ? <p className={cn("max-w-md text-right text-xs leading-5", dark ? "text-slate-300" : "text-slate-500")}>{aside}</p> : null}
    </div>
  );
}

function SourceEvidence({ source }: { source: MarketSourceEvidence }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-semibold text-slate-950">{source.label}</p>
          <p className="mt-1 text-xs text-slate-500">{source.sample_count} samples</p>
        </div>
        <StatusPill status={source.status} />
      </div>
      <p className="mt-4 text-2xl font-semibold text-slate-950">{optionalMoney(source.median_rate_cents)}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <span>Avg {optionalMoney(source.average_rate_cents)}</span>
        <span>Conf. {percent(source.confidence)}</span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{source.role}</p>
    </div>
  );
}

function PricingLayerRow({ layer, baseRate }: { layer: PricingAdjustmentLayer; baseRate: number }) {
  const impact = Math.min(100, Math.abs(layer.rate_impact_cents) / Math.max(baseRate, 1) * 100);
  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_160px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-950">{layer.label}</p>
          <span className="rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-600">{layer.category}</span>
          <StatusPill status={layer.status} />
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{layer.description}</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">{layer.data_feed}</p>
      </div>
      <div className="grid content-center gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className={cn("font-semibold", layer.rate_impact_cents >= 0 ? "text-emerald-700" : "text-rose-700")}>
            {signedMoney(layer.rate_impact_cents)}
          </span>
          <span className="text-slate-500">{signedPercent(layer.adjustment_percent)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white">
          <div className={cn("h-full rounded-full", layer.rate_impact_cents >= 0 ? "bg-emerald-500" : "bg-rose-500")} style={{ width: `${Math.max(8, impact)}%` }} />
        </div>
        <p className="text-xs text-slate-500">Confidence {percent(layer.confidence)}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const live = status.includes("live") || status === "active";
  const pending = status.includes("pending") || status.includes("awaiting") || status.includes("needs");
  return (
    <span
      className={cn(
        "rounded-md px-2 py-1 text-xs font-medium",
        live ? "bg-emerald-50 text-emerald-700" : pending ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600",
      )}
      title={statusLabel(status, "long")}
    >
      {statusLabel(status)}
    </span>
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

function signedPercent(value: number) {
  const formatted = percent(Math.abs(value));
  if (value === 0) return "0%";
  return `${value > 0 ? "+" : "-"}${formatted}`;
}

function optionalMoney(cents: number | null) {
  return cents === null ? "Pending" : money(cents);
}

function signedMoney(cents: number) {
  if (cents === 0) return "$0";
  return `${cents > 0 ? "+" : "-"}${money(Math.abs(cents))}`;
}

function statusLabel(value: string, length: "short" | "long" = "short") {
  const shortLabels: Record<string, string> = {
    active: "Active",
    active_model: "Model",
    awaiting_feed: "Needs feed",
    awaiting_clean_scrape: "Awaiting",
    live_agent_scrape: "Live scrape",
    manual_active: "Manual",
    modeled: "Modeled",
    modeled_until_scrape: "Modeled",
    needs_calendar_feed: "Needs feed",
    needs_channel_feed: "Needs feed",
    needs_owner_input: "Needs input",
    needs_pms_feed: "Needs PMS",
    pending_review_feed: "Pending",
    ready_for_inputs: "Ready",
  };
  if (length === "short" && shortLabels[value]) return shortLabels[value];
  return value.replaceAll("_", " ");
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}
