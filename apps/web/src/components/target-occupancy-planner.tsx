"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Chrome,
  CircleDollarSign,
  LoaderCircle,
  Percent,
  Target,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PropertyResponse, TargetOccupancyPlanResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const ORG_ID = process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? "00000000-0000-0000-0000-000000000001";
const USER_ID = process.env.NEXT_PUBLIC_USER_ID ?? "00000000-0000-0000-0000-000000000002";

type Props = {
  propertyId?: string;
  properties?: PropertyResponse[];
  compact?: boolean;
};

export function TargetOccupancyPlanner({ propertyId, properties = [], compact = false }: Props) {
  const [selectedPropertyId, setSelectedPropertyId] = useState(propertyId ?? properties[0]?.id ?? "");
  const [targetMonth, setTargetMonth] = useState("2026-07");
  const [targetOccupancy, setTargetOccupancy] = useState(90);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<TargetOccupancyPlanResponse | null>(null);
  const activePropertyId = propertyId ?? selectedPropertyId;
  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === activePropertyId),
    [activePropertyId, properties],
  );

  useEffect(() => {
    if (!propertyId && !selectedPropertyId && properties[0]?.id) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [properties, propertyId, selectedPropertyId]);

  if (compact && !activePropertyId) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activePropertyId) return;
    try {
      setStatus("loading");
      setError("");
      const response = await fetch(`/api/backend/properties/${activePropertyId}/target-occupancy-plan`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Organization-Id": ORG_ID,
          "X-User-Id": USER_ID,
        },
        body: JSON.stringify({
          target_month: `${targetMonth}-01`,
          target_occupancy: targetOccupancy / 100,
          refresh_browser_data: true,
        }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await response.text());
      setPlan((await response.json()) as TargetOccupancyPlanResponse);
      setStatus("ready");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Unable to build the plan.");
    }
  }

  return (
    <section
      className={cn(
        "rounded-[28px] border border-cyan-900/10 bg-white/88 p-5 shadow-[0_24px_90px_rgba(14,116,144,0.13)]",
        compact ? "mt-5" : "p-5 sm:p-6",
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">Booking Rate Planner</p>
          <h2 className={cn("mt-2 font-semibold tracking-normal text-slate-950", compact ? "text-2xl" : "text-3xl")}>
            What rate gets this booked?
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Pick a month and occupancy goal. RentalRadar queues headed Chrome scans for that exact stay window and turns the
            live comp evidence into a rate and action plan.
          </p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-full border border-cyan-900/10 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-800">
          <Chrome className="size-4" />
          Headed browser backed
        </div>
      </div>

      <form onSubmit={submit} className="mt-5 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_170px_160px_auto] lg:items-end">
        {!propertyId ? (
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Property</span>
            <select
              value={selectedPropertyId}
              onChange={(event) => setSelectedPropertyId(event.target.value)}
              className="h-11 rounded-xl border border-cyan-900/10 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600"
            >
              {properties.length ? null : <option value="">Add a property first</option>}
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name || property.formatted_address || property.address_line1}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="rounded-2xl border border-cyan-900/10 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Property</p>
            <p className="mt-1 truncate text-sm font-medium text-slate-950">{selectedProperty?.formatted_address ?? "New property"}</p>
          </div>
        )}

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Month</span>
          <input
            value={targetMonth}
            onChange={(event) => setTargetMonth(event.target.value)}
            type="month"
            min="2026-05"
            className="h-11 rounded-xl border border-cyan-900/10 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600"
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Occupancy goal</span>
          <div className="relative">
            <input
              value={targetOccupancy}
              onChange={(event) => setTargetOccupancy(Number(event.target.value))}
              type="number"
              min="5"
              max="98"
              className="h-11 w-full rounded-xl border border-cyan-900/10 bg-white px-3 pr-9 text-sm text-slate-950 outline-none transition focus:border-cyan-600"
              required
            />
            <Percent className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          </div>
        </label>

        <button
          type="submit"
          disabled={!activePropertyId || status === "loading"}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-cyan-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading" ? <LoaderCircle className="size-4 animate-spin" /> : <Target className="size-4" />}
          Build plan
        </button>
      </form>

      {status === "error" ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      {plan ? (
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Metric icon={CircleDollarSign} label="Suggested average rate" value={money(plan.suggested_average_rate_cents)} />
            <Metric icon={Percent} label="Current projected occupancy" value={percent(plan.current_projected_occupancy)} />
            <Metric icon={TrendingUp} label="Projected month revenue" value={money(plan.projected_revenue_cents)} />
            <Metric icon={CalendarDays} label="Market average rate" value={money(plan.market_average_rate_cents)} />
          </div>

          <div className="rounded-3xl border border-cyan-900/10 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Game plan</p>
                <h3 className="mt-2 text-xl font-semibold tracking-normal text-slate-950">
                  {monthLabel(plan.target_month)} at {percent(plan.target_occupancy)}
                </h3>
              </div>
              <span className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                {percent(plan.confidence)} confidence
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              {plan.game_plan.map((item) => (
                <p key={item} className="flex gap-3 rounded-2xl bg-white p-3 text-sm leading-6 text-slate-700">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-cyan-700" />
                  {item}
                </p>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-cyan-900/10 bg-white p-4">
              <div className="flex items-start gap-3">
                <Chrome className="mt-0.5 size-5 shrink-0 text-cyan-700" />
                <div>
                  <p className="font-semibold text-slate-950">Browser evidence</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{plan.browser_evidence.message}</p>
                  <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                    {plan.browser_evidence.observations_used} observations used · {plan.browser_evidence.queued_job_ids.length} browser scans queued
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-cyan-900/10 bg-white">
              {plan.nights.slice(0, 7).map((night) => (
                <div key={night.stay_date} className="grid grid-cols-[0.8fr_0.6fr_0.6fr_1.3fr] gap-3 border-b border-cyan-900/5 px-4 py-3 text-sm last:border-b-0">
                  <span className="text-slate-600">{shortDate(night.stay_date)}</span>
                  <span className="font-semibold text-slate-950">{money(night.suggested_rate_cents)}</span>
                  <span className="text-cyan-700">{percent(night.expected_occupancy)}</span>
                  <span className="text-slate-500">{night.strategy}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-cyan-900/10 bg-slate-50 p-4">
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
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}
