import { MarketRatesResponse, Plan, PropertyResponse } from "@/lib/types";

const today = new Date();
const day = (offset: number) => {
  const value = new Date(today);
  value.setDate(today.getDate() + offset);
  return value.toISOString().slice(0, 10);
};

export const demoProperty: PropertyResponse = {
  id: "11111111-1111-4111-8111-111111111111",
  organization_id: process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? "00000000-0000-0000-0000-000000000001",
  name: "Oceanview Two Bedroom",
  formatted_address: "1250 Ocean Drive, Miami Beach, FL",
  address_line1: "1250 Ocean Drive, Miami Beach, FL",
  bedrooms: 2,
  bathrooms: 2,
  sleeps: 6,
  market_scan_job_ids: [],
};

export const demoMarketRates: MarketRatesResponse = {
  property_id: demoProperty.id,
  cached: false,
  observations: Array.from({ length: 28 }).flatMap((_, index) => {
    const base = 22000 + Math.round(Math.sin(index / 3) * 2400) + (index % 6 === 0 ? 3800 : 0);
    return [
      ["airbnb", base + 1800],
      ["vrbo", base - 600],
      ["booking", base + 900],
      ["direct_pms", base - 1400],
    ].map(([source, rate], sourceIndex) => ({
      id: `${index}-${source}`,
      source: source as never,
      competitor_id: `${source}-${sourceIndex}`,
      stay_date: day(index + 1),
      nightly_rate_cents: Number(rate),
      total_rate_cents: Number(rate) + 3200,
      available: index % 8 !== sourceIndex,
      extraction_confidence: 0.78 + sourceIndex * 0.04,
      observed_at: new Date().toISOString(),
    }));
  }),
  recommendations: Array.from({ length: 28 }).map((_, index) => {
    const weekend = [5, 6].includes(new Date(day(index + 1)).getDay());
    const rate = 23800 + Math.round(Math.cos(index / 4) * 2100) + (weekend ? 4600 : 0);
    return {
      id: `rec-${index}`,
      stay_date: day(index + 1),
      current_rate_cents: 21900,
      recommended_rate_cents: rate,
      recommended_min_stay: weekend ? 2 : 1,
      discount_percent: index < 4 ? 5 : 0,
      confidence: 0.74 + (index % 5) * 0.03,
      status: "pending_approval",
      reason: {
        ai_advice: {
          summary: weekend
            ? "Live comps show compressed weekend supply; hold a premium and keep the stay rule firm."
            : "Fresh comp data supports a steady market-following rate.",
          risk_flags: index % 9 === 0 ? ["near-term demand is soft"] : [],
        },
        competitive_logic: {
          beyond_style_calendar_rate_cents: rate - 1100,
          wheelhouse_style_comp_rate_cents: rate - 700,
          rentalradar_live_rate_cents: rate,
          advantage: "RentalRadar is weighting fresh scraped availability and PMS pacing in the same decision.",
        },
        market: {
          sample_size: 12 + (index % 4),
          source_count: 4,
          available_ratio: 0.32 + (index % 5) * 0.08,
          comp_median_cents: rate - 500,
        },
        signals: {
          market_compression: 0.64,
          live_data_quality: 0.82,
          event_strength: index === 12 ? 0.91 : 0.24,
          lead_time_days: index + 1,
        },
      },
    };
  }),
};

export const plans: Plan[] = [
  { code: "free_1", name: "Free", price: 0, scrapes: "Limited", comps: "5 comps", push: false },
  { code: "starter_3", name: "Starter", price: 3, scrapes: "Daily", comps: "10 comps", push: false },
  { code: "growth_6", name: "Growth", price: 6, scrapes: "4x daily", comps: "25 comps", push: true },
  { code: "pro_9", name: "Pro", price: 9, scrapes: "Hourly", comps: "50 comps", push: true },
];
