import { Badge } from "@/components/ui/badge";
import { MarketRatesResponse } from "@/lib/types";
import { money } from "@/lib/utils";

const labels: Record<string, string> = {
  airbnb: "Airbnb",
  vrbo: "VRBO",
  booking: "Booking",
  direct_pms: "Direct",
  guesty: "Direct",
  hostaway: "Direct",
  ownerrez: "Direct",
};

export function SourceBreakdown({ market }: { market: MarketRatesResponse }) {
  const rows = Object.entries(
    market.observations.reduce<Record<string, { rates: number[]; available: number; total: number }>>((acc, item) => {
      const key = labels[item.source] ?? "Other";
      acc[key] ??= { rates: [], available: 0, total: 0 };
      if (item.nightly_rate_cents) acc[key].rates.push(item.nightly_rate_cents);
      if (item.available) acc[key].available += 1;
      acc[key].total += 1;
      return acc;
    }, {}),
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {rows.map(([source, value]) => {
        const average = value.rates.length ? value.rates.reduce((sum, rate) => sum + rate, 0) / value.rates.length : null;
        const availability = value.total ? Math.round((value.available / value.total) * 100) : 0;
        return (
          <div key={source} className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{source}</p>
              <Badge variant={availability < 45 ? "warning" : "secondary"}>{availability}% open</Badge>
            </div>
            <p className="mt-3 text-2xl font-semibold">{money(average ? Math.round(average) : null)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{value.total} live observations</p>
          </div>
        );
      })}
    </div>
  );
}
