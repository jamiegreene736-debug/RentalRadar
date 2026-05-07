"use client";

import { useMemo, useActionState } from "react";
import { RadioTower, SendHorizontal, ShieldCheck, TrendingUp } from "lucide-react";

import { applyRecommendationsAction } from "@/app/actions";
import { SubmitButton } from "@/components/action-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PricingRecommendation } from "@/lib/types";
import { money, percent, shortDate } from "@/lib/utils";

const initialState = { ok: false, message: "" };

export function RecommendationsTable({
  propertyId,
  recommendations,
}: {
  propertyId: string;
  recommendations: PricingRecommendation[];
}) {
  const [state, action] = useActionState(applyRecommendationsAction, initialState);
  const top = recommendations.slice(0, 12);
  const payload = useMemo(
    () =>
      JSON.stringify(
        top.map((rec) => ({
          stay_date: rec.stay_date,
          rate_cents: rec.recommended_rate_cents,
          pricing_recommendation_id: rec.id,
        })),
      ),
    [top],
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Pricing Recommendations</h2>
          <p className="text-sm text-muted-foreground">Next 12 optimized nights</p>
        </div>
        <form action={action} className="flex flex-col gap-2 sm:items-end">
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="rates" value={payload} />
          <SubmitButton>
            <SendHorizontal />
            Apply to all channels
          </SubmitButton>
          {state.message ? (
            <span className={state.ok ? "text-xs text-emerald-700" : "text-xs text-destructive"}>{state.message}</span>
          ) : null}
        </form>
      </div>
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="grid min-w-[760px] grid-cols-[0.8fr_1fr_1fr_1fr_1.2fr_1.5fr] border-b bg-muted/60 px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <span>Date</span>
          <span>Rate</span>
          <span>Min Stay</span>
          <span>Discount</span>
          <span>Confidence</span>
          <span>Live Edge</span>
        </div>
        <div className="max-h-[456px] min-w-[760px] overflow-y-auto">
          {top.map((rec) => (
            <div
              key={rec.id}
              className="grid grid-cols-[0.8fr_1fr_1fr_1fr_1.2fr_1.5fr] items-center border-b px-4 py-3 text-sm last:border-b-0"
            >
              <span className="font-medium">{shortDate(rec.stay_date)}</span>
              <span className="text-lg font-semibold">{money(rec.recommended_rate_cents)}</span>
              <span>{rec.recommended_min_stay ?? 1} nights</span>
              <span>{rec.discount_percent ? `${rec.discount_percent}%` : "None"}</span>
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-600" />
                {percent(rec.confidence)}
              </span>
              <span className="flex items-center gap-2">
                {rec.reason.signals?.event_strength && rec.reason.signals.event_strength > 0.75 ? (
                  <Badge variant="warning">
                    <RadioTower className="mr-1 size-3" />
                    Event
                  </Badge>
                ) : (
                  <Badge>
                    <TrendingUp className="mr-1 size-3" />
                    Live comps
                  </Badge>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
