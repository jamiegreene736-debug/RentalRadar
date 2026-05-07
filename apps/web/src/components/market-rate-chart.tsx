"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { MarketRatesResponse } from "@/lib/types";
import { money, shortDate } from "@/lib/utils";

const sourceLabels = {
  airbnb: "Airbnb",
  vrbo: "VRBO",
  booking: "Booking",
  direct_pms: "Direct",
  guesty: "Direct",
  hostaway: "Direct",
  ownerrez: "Direct",
  manual: "Manual",
  other: "Other",
} as const;

export function MarketRateChart({ market }: { market: MarketRatesResponse }) {
  const rows = buildRows(market);
  return (
    <div className="h-[318px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="recommend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-recommend))" stopOpacity={0.28} />
              <stop offset="95%" stopColor="hsl(var(--chart-recommend))" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={24} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${Math.round(Number(value) / 100)}`}
            width={52}
          />
          <Tooltip
            formatter={(value) => money(Number(value))}
            labelClassName="font-medium"
            contentStyle={{ borderRadius: 8, borderColor: "hsl(var(--border))" }}
          />
          <Area type="monotone" dataKey="airbnb" name="Airbnb" stroke="hsl(var(--chart-airbnb))" fillOpacity={0.04} fill="hsl(var(--chart-airbnb))" strokeWidth={2} />
          <Area type="monotone" dataKey="vrbo" name="VRBO" stroke="hsl(var(--chart-vrbo))" fillOpacity={0.04} fill="hsl(var(--chart-vrbo))" strokeWidth={2} />
          <Area type="monotone" dataKey="booking" name="Booking" stroke="hsl(var(--chart-booking))" fillOpacity={0.04} fill="hsl(var(--chart-booking))" strokeWidth={2} />
          <Area type="monotone" dataKey="direct" name="Direct" stroke="hsl(var(--chart-direct))" fillOpacity={0.04} fill="hsl(var(--chart-direct))" strokeWidth={2} />
          <Area type="monotone" dataKey="recommendation" name="RentalRadar" stroke="hsl(var(--chart-recommend))" fill="url(#recommend)" strokeWidth={3} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function buildRows(market: MarketRatesResponse) {
  const byDate = new Map<string, Record<string, number[]>>();
  for (const observation of market.observations) {
    const key = sourceLabels[observation.source] === "Direct" ? "direct" : observation.source;
    const day = byDate.get(observation.stay_date) ?? {};
    const values = day[key] ?? [];
    if (observation.nightly_rate_cents) values.push(observation.nightly_rate_cents);
    day[key] = values;
    byDate.set(observation.stay_date, day);
  }
  const recs = new Map(market.recommendations.map((rec) => [rec.stay_date, rec.recommended_rate_cents]));
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 28)
    .map(([stayDate, values]) => ({
      stayDate,
      label: shortDate(stayDate),
      airbnb: average(values.airbnb),
      vrbo: average(values.vrbo),
      booking: average(values.booking),
      direct: average(values.direct),
      recommendation: recs.get(stayDate),
    }));
}

function average(values?: number[]) {
  if (!values?.length) return undefined;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
