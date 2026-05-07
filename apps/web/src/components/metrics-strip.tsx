import { Activity, CalendarDays, DatabaseZap, DollarSign } from "lucide-react";

import { MarketRatesResponse } from "@/lib/types";
import { money, percent } from "@/lib/utils";

export function MetricsStrip({ market }: { market: MarketRatesResponse }) {
  const nextRecommendation = market.recommendations[0];
  const observations = market.observations.length;
  const averageConfidence =
    market.recommendations.reduce((sum, rec) => sum + (rec.confidence ?? 0), 0) /
    Math.max(1, market.recommendations.length);
  const available =
    market.observations.filter((item) => item.available).length / Math.max(1, market.observations.length);
  const sources = new Set(market.observations.map((item) => item.source)).size;

  const metrics = [
    { label: "Next Rate", value: money(nextRecommendation?.recommended_rate_cents), icon: DollarSign },
    { label: "Confidence", value: percent(averageConfidence), icon: Activity },
    { label: "Live Data", value: `${observations}`, icon: DatabaseZap },
    { label: "Sources", value: `${sources}`, icon: CalendarDays },
    { label: "Open Nights", value: percent(available), icon: Activity },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-3 text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-[0.08em]">{metric.label}</span>
            <metric.icon className="size-4" />
          </div>
          <p className="mt-3 text-2xl font-semibold">{metric.value}</p>
        </div>
      ))}
    </div>
  );
}
