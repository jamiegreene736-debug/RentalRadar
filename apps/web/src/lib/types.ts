export type Source = "airbnb" | "vrbo" | "booking" | "direct_pms" | "guesty" | "hostaway" | "ownerrez" | "manual" | "other";

export type PropertyResponse = {
  id: string;
  organization_id: string;
  name: string | null;
  formatted_address: string | null;
  address_line1: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sleeps: number | null;
  market_scan_job_ids: string[];
};

export type RateObservation = {
  id: string;
  source: Source;
  competitor_id: string | null;
  stay_date: string;
  nightly_rate_cents: number | null;
  total_rate_cents: number | null;
  available: boolean | null;
  extraction_confidence: number | null;
  observed_at: string;
};

export type PricingRecommendation = {
  id: string;
  stay_date: string;
  current_rate_cents: number | null;
  recommended_rate_cents: number;
  recommended_min_stay: number | null;
  discount_percent: number | null;
  confidence: number | null;
  status: string;
  reason: {
    ai_advice?: { summary?: string; risk_flags?: string[] };
    competitive_logic?: {
      beyond_style_calendar_rate_cents?: number;
      wheelhouse_style_comp_rate_cents?: number;
      rentalradar_live_rate_cents?: number;
      advantage?: string;
    };
    market?: {
      sample_size?: number;
      source_count?: number;
      available_ratio?: number | null;
      comp_median_cents?: number | null;
    };
    signals?: {
      market_compression?: number;
      live_data_quality?: number;
      event_strength?: number;
      lead_time_days?: number;
    };
    [key: string]: unknown;
  };
};

export type MarketRatesResponse = {
  property_id: string;
  cached: boolean;
  observations: RateObservation[];
  recommendations: PricingRecommendation[];
};

export type ScrapeSessionEvent = {
  at: string;
  event: string;
  level: string;
  message: string | null;
  url: string | null;
  status: number | null;
};

export type ScrapeSession = {
  id: string;
  source: Source;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled" | "needs_review" | string;
  target_url: string;
  browser_session_id: string;
  started_at: string | null;
  completed_at: string | null;
  current_url: string | null;
  latest_screenshot_data_url: string | null;
  events: ScrapeSessionEvent[];
};

export type ScrapeSessionsResponse = {
  property_id: string;
  sessions: ScrapeSession[];
};

export type PmsProvider =
  | "guesty"
  | "hostaway"
  | "streamline"
  | "ciirus"
  | "ownerrez"
  | "lodgify"
  | "hostfully"
  | "airbnb"
  | "vrbo"
  | "booking"
  | "direct"
  | "other";

export type OtaDirectPlatform = "airbnb" | "vrbo" | "booking";
export type OtaDirectStatus = "pending" | "active" | "2fa_required" | "failed" | "revoked";

export type OtaDirectCredential = {
  id: string;
  property_id: string;
  platform: OtaDirectPlatform;
  status: OtaDirectStatus;
  last_successful_login: string | null;
  last_push: string | null;
  failure_count: number;
  two_fa_attempts: number;
  last_error: string | null;
  high_risk_notice: string;
};

export type OtaDirectStatusResponse = {
  credentials: OtaDirectCredential[];
  high_risk_notice: string;
};

export type ActionState = {
  ok: boolean;
  message: string;
  propertyId?: string;
};

export type Plan = {
  code: string;
  name: string;
  price: number;
  scrapes: string;
  comps: string;
  push: boolean;
};

export type BillingSessionResponse = {
  url: string;
  mode?: string | null;
  session_id?: string | null;
};

export type UsageSummaryResponse = {
  plan: {
    code: string;
    name: string;
    free_tier: boolean;
    monthly_price_cents: number;
    max_compute_units_per_month: number;
    max_jobs_per_day: number;
    max_scrapes_per_property_month: number;
  };
  usage: {
    compute_units_month: number;
    jobs_today: number;
    period_start: string;
    next_reset_estimate: string;
  };
};

export type ScrapingLegalNoticeResponse = {
  title: string;
  body: string;
  commitments: string[];
  user_responsibilities: string[];
};

export type ErrorDashboardResponse = {
  counts: Record<string, number>;
  recent_errors: Array<{
    id: string;
    source: string;
    status: string;
    message: string | null;
    created_at: string | null;
    detail: Record<string, unknown>;
  }>;
};
