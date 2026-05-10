import { Badge } from "@/components/ui/badge";
import { PricingRecommendation } from "@/lib/types";
import { money, percent } from "@/lib/utils";

export function CompetitiveInsight({ recommendation }: { recommendation?: PricingRecommendation }) {
  const logic = recommendation?.reason.competitive_logic;
  const signals = recommendation?.reason.signals;
  const marketBooked = recommendation?.reason.market_booked_rate;
  const paidSource = logic?.market_paid_source || marketBooked?.source || "Booked-market feed";
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-lg border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Calendar benchmark</p>
        <p className="mt-3 text-2xl font-semibold">{money(logic?.calendar_benchmark_rate_cents)}</p>
        <p className="mt-1 text-sm text-muted-foreground">Calendar curve benchmark</p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Live comp benchmark</p>
        <p className="mt-3 text-2xl font-semibold">{money(logic?.comp_blend_rate_cents)}</p>
        <p className="mt-1 text-sm text-muted-foreground">Guest-visible rates plus paid-market context</p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Paid market rate</p>
          {marketBooked?.status ? <Badge variant={marketBooked.status === "succeeded" ? "success" : "secondary"}>{marketBooked.status}</Badge> : null}
        </div>
        <p className="mt-3 text-2xl font-semibold">{money(logic?.market_paid_rate_cents ?? marketBooked?.booked_rate_cents)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {marketBooked?.sample_size ? `${marketBooked.sample_size} booked comps from ${paidSource}` : paidSource}
        </p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">RentalRadar</p>
          <Badge variant="success">{percent(signals?.live_data_quality)}</Badge>
        </div>
        <p className="mt-3 text-2xl font-semibold">{money(logic?.rentalradar_live_rate_cents)}</p>
        <p className="mt-1 text-sm text-muted-foreground">{recommendation?.reason.ai_advice?.summary}</p>
      </div>
    </div>
  );
}
