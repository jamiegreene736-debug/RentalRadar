"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, BrainCircuit, CheckCircle2, LoaderCircle, Sparkles, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { MarketRatesResponse, PricingRecommendation, PropertyResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

type Status = "idle" | "loading" | "ready" | "error";

export function LlmPricingWorkspace({ property }: { property: PropertyResponse }) {
  const [status, setStatus] = useState<Status>("loading");
  const [marketRates, setMarketRates] = useState<MarketRatesResponse | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function load() {
    try {
      setStatus("loading");
      setError("");
      const response = await fetch(`/api/backend/properties/${property.id}/market-rates`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`LLM layer unavailable: ${response.status}`);
      setMarketRates((await response.json()) as MarketRatesResponse);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load LLM pricing layer.");
      setStatus("error");
    }
  }

  useEffect(() => {
    void load();
  }, [property.id]);

  const recommendations = useMemo(
    () => (marketRates?.recommendations ?? []).filter((rec) => rec.reason?.ai_advice).slice(0, 14),
    [marketRates],
  );
  const profile = useMemo(() => buildProfile(recommendations), [recommendations]);

  function runPricing() {
    startTransition(async () => {
      setError("");
      const response = await fetch("/api/backend/pricing/recommendations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ property_id: property.id }),
      });
      if (!response.ok) {
        setError(`Pricing run failed: ${response.status}`);
        return;
      }
      await load();
    });
  }

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">LLM Layer</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">AI pricing decision layer</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {property.formatted_address ?? property.address_line1}
          </p>
        </div>
        <button
          type="button"
          onClick={runPricing}
          disabled={isPending}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Run LLM pricing
        </button>
      </div>

      {status === "loading" ? (
        <div className="grid min-h-52 place-items-center rounded-lg border border-cyan-900/10 bg-white text-slate-600 shadow-sm">
          <div className="text-center">
            <LoaderCircle className="mx-auto size-8 animate-spin text-cyan-700" />
            <p className="mt-3 text-sm font-medium">Loading pricing decisions</p>
          </div>
        </div>
      ) : null}

      {status === "error" || error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error || "Unable to load the LLM pricing layer."}
        </div>
      ) : null}

      {status === "ready" ? (
        recommendations.length ? (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
              <Metric icon={BrainCircuit} label="Decision mode" value={profile.modeLabel} />
              <Metric icon={CheckCircle2} label="Provider status" value={profile.statusLabel} />
              <Metric icon={TrendingUp} label="Avg. rate bias" value={signedPercent(profile.averageRateBias)} />
              <Metric icon={AlertTriangle} label="Risk flags" value={`${profile.riskCount}`} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
              <Panel>
                <PanelHeader icon={BrainCircuit} eyebrow="Model posture" title={profile.strategy} aside={profile.providerLabel} />
                <div className="mt-4 grid gap-3">
                  <MiniStat label="Demand read" value={profile.demandRead} />
                  <MiniStat label="Evidence" value={profile.evidence.join(", ")} />
                  <MiniStat label="Confidence bias" value={signedPercent(profile.averageConfidenceBias)} />
                </div>
              </Panel>

              <Panel>
                <PanelHeader icon={Sparkles} eyebrow="Nightly reasoning" title="Recent LLM-adjusted recommendations" />
                <div className="mt-4 grid gap-3">
                  {recommendations.map((recommendation) => (
                    <RecommendationRow key={recommendation.id} recommendation={recommendation} />
                  ))}
                </div>
              </Panel>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-cyan-900/10 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">No decisions yet</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Run pricing to create LLM-backed recommendations</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              The pricing engine will write the LLM layer into each recommendation explanation.
            </p>
          </div>
        )
      ) : null}
    </section>
  );
}

function RecommendationRow({ recommendation }: { recommendation: PricingRecommendation }) {
  const advice = recommendation.reason.ai_advice ?? {};
  const riskFlags = advice.risk_flags ?? [];
  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[128px_minmax(0,1fr)_120px]">
      <div>
        <p className="text-xs font-medium text-slate-500">{shortDate(recommendation.stay_date)}</p>
        <p className="mt-1 text-lg font-semibold text-slate-950">{money(recommendation.recommended_rate_cents)}</p>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={advice.status ?? "pending"} />
          <span className="rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-600">
            {advice.demand_read ?? "balanced demand"}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{advice.summary ?? "LLM summary pending."}</p>
        {riskFlags.length ? <p className="mt-2 text-xs leading-5 text-amber-800">{riskFlags.join(", ")}</p> : null}
      </div>
      <div className="grid content-center gap-1 text-sm">
        <span className="font-semibold text-slate-950">{signedPercent(advice.rate_bias ?? 0)}</span>
        <span className="text-xs text-slate-500">rate bias</span>
      </div>
    </div>
  );
}

function buildProfile(recommendations: PricingRecommendation[]) {
  const advice = recommendations.map((rec) => rec.reason.ai_advice).filter(Boolean);
  const first = advice[0] ?? {};
  const averageRateBias = average(advice.map((item) => item?.rate_bias ?? 0));
  const averageConfidenceBias = average(advice.map((item) => item?.confidence_bias ?? 0));
  const evidence = Array.from(new Set(advice.flatMap((item) => item?.evidence_used ?? []))).slice(0, 4);
  const risks = advice.flatMap((item) => item?.risk_flags ?? []);
  return {
    averageRateBias,
    averageConfidenceBias,
    evidence: evidence.length ? evidence : ["pricing guardrails"],
    riskCount: risks.length,
    demandRead: first.demand_read ?? "balanced demand",
    strategy: first.strategy ?? "Blend live browser evidence, booked-rate data, occupancy, pace, and event context.",
    modeLabel: first.mode === "llm" ? "Live LLM" : "Safe fallback",
    statusLabel: statusLabel(first.status ?? "pending"),
    providerLabel: [first.provider, first.model].filter(Boolean).join(" / ") || "provider pending",
  };
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-cyan-900/10 bg-white p-4 shadow-sm">{children}</div>;
}

function PanelHeader({
  icon: Icon,
  eyebrow,
  title,
  aside,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  aside?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-cyan-50 text-cyan-700">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">{eyebrow}</p>
          <h3 className="mt-1 text-lg font-semibold leading-tight text-slate-950">{title}</h3>
        </div>
      </div>
      {aside ? <p className="max-w-md text-right text-xs leading-5 text-slate-500">{aside}</p> : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-slate-950">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const live = status === "succeeded";
  const warning = status.includes("missing") || status.includes("failed") || status.includes("not_enabled");
  return (
    <span
      className={cn(
        "rounded-md px-2 py-1 text-xs font-medium",
        live ? "bg-emerald-50 text-emerald-700" : warning ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600",
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function signedPercent(value: number) {
  const rounded = Math.round(Math.abs(value) * 100);
  if (rounded === 0) return "0%";
  return `${value > 0 ? "+" : "-"}${rounded}%`;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}
