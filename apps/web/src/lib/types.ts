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

export type MarketScanResponse = {
  property_id: string;
  queued_job_ids: string[];
  message: string;
};

export type AddressSuggestion = {
  place_id: string;
  formatted_address: string;
  address_line1: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country_code: string;
  latitude: number | null;
  longitude: number | null;
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
      calendar_benchmark_rate_cents?: number;
      comp_blend_rate_cents?: number;
      market_paid_rate_cents?: number | null;
      market_paid_source?: string | null;
      rentalradar_live_rate_cents?: number;
      advantage?: string;
    };
    market_booked_rate?: {
      source?: string | null;
      status?: string | null;
      message?: string | null;
      average_booked_rate_cents?: number | null;
      median_booked_rate_cents?: number | null;
      booked_rate_cents?: number | null;
      market_occupancy?: number | null;
      revpar_cents?: number | null;
      sample_size?: number;
      confidence?: number;
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
  payload: Record<string, unknown> | null;
};

export type ScrapeSession = {
  id: string;
  source: Source;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled" | "needs_review" | string;
  target_url: string;
  browser_session_id: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  current_url: string | null;
  latest_screenshot_data_url: string | null;
  error_code: string | null;
  error_message: string | null;
  diagnostics: Record<string, unknown>;
  progress_percent: number;
  progress_label: string;
  queue_position: number | null;
  events: ScrapeSessionEvent[];
};

export type ScrapeSessionsResponse = {
  property_id: string;
  sessions: ScrapeSession[];
};

export type RateForecastNight = {
  stay_date: string;
  recommended_rate_cents: number;
  market_benchmark_rate_cents: number;
  comp_blend_rate_cents: number;
  estimated_occupancy: number;
  estimated_revenue_cents: number;
  confidence: number;
};

export type MonthlyRateForecast = {
  month: string;
  average_recommended_rate_cents: number;
  average_market_benchmark_rate_cents: number;
  average_comp_blend_rate_cents: number;
  estimated_occupancy: number;
  estimated_revenue_cents: number;
  market_benchmark_revenue_cents: number;
  extra_income_vs_market_cents: number;
};

export type MarketSourceEvidence = {
  source: string;
  label: string;
  role: string;
  status: string;
  sample_count: number;
  median_rate_cents: number | null;
  average_rate_cents: number | null;
  low_rate_cents: number | null;
  high_rate_cents: number | null;
  confidence: number;
  last_observed_at: string | null;
  note: string;
};

export type BaseRateModel = {
  method: string;
  base_rate_cents: number;
  market_median_rate_cents: number | null;
  market_average_rate_cents: number | null;
  sample_size: number;
  source_count: number;
  booked_rate_feed: string;
  explanation: string;
};

export type PricingAdjustmentLayer = {
  code: string;
  label: string;
  category: string;
  data_feed: string;
  adjustment_percent: number;
  rate_impact_cents: number;
  confidence: number;
  status: string;
  description: string;
};

export type PricingToolCoverage = {
  code: string;
  label: string;
  category: string;
  status: string;
  priority: string;
  current_value: string;
  recommended_value: string;
  control_references: string[];
  data_needed: string;
  description: string;
};

export type PricingControls = {
  property_id: string;
  base_price_cents: number | null;
  min_price_cents: number | null;
  max_price_cents: number | null;
  absolute_min_price_cents: number | null;
  global_min_stay: number;
  weekday_min_stay: number;
  weekend_min_stay: number;
  gap_night_min_stay: number;
  gap_night_discount_percent: number;
  last_minute_window_days: number;
  last_minute_discount_percent: number;
  far_future_window_days: number;
  far_future_premium_percent: number;
  orphan_gap_enabled: boolean;
  seasonal_rules_enabled: boolean;
  event_rules_enabled: boolean;
  pacing_adjustments_enabled: boolean;
  review_adjustments_enabled: boolean;
  availability_yielding_enabled: boolean;
  channel_fee_preview_enabled: boolean;
};

export type SeasonBand = {
  code: "low" | "middle" | "high" | string;
  label: string;
  months: number[];
  month_labels: string[];
  multiplier: number;
  minimum_stay_nights: number;
  booking_posture: string;
  notes: string;
};

export type HolidayWindow = {
  label: string;
  date_window: string;
  multiplier: number;
  minimum_stay_nights: number;
  notes: string;
};

export type SeasonCalendarResponse = {
  property_id: string;
  market_key: string;
  market_label: string;
  basis: string;
  current_model_note: string;
  seasons: SeasonBand[];
  holidays: HolidayWindow[];
};

export type RateForecastResponse = {
  property_id: string;
  months: number;
  currency_code: string;
  address: string | null;
  generated_at: string;
  estimated_occupancy: number;
  recommended_total_revenue_cents: number;
  market_benchmark_total_revenue_cents: number;
  extra_income_vs_market_cents: number;
  confidence: number;
  explanation: string;
  base_rate_model: BaseRateModel;
  market_sources: MarketSourceEvidence[];
  adjustment_layers: PricingAdjustmentLayer[];
  pricing_tools: PricingToolCoverage[];
  monthly: MonthlyRateForecast[];
  nights: RateForecastNight[];
};

export type TargetOccupancyNight = {
  stay_date: string;
  suggested_rate_cents: number;
  market_rate_cents: number;
  expected_occupancy: number;
  strategy: string;
};

export type BrowserEvidence = {
  status: string;
  queued_job_ids: string[];
  completed_scan_count: number;
  observations_used: number;
  latest_observed_at: string | null;
  sources: string[];
  message: string;
};

export type TargetOccupancyPlanResponse = {
  property_id: string;
  currency_code: string;
  address: string | null;
  generated_at: string;
  target_month: string;
  target_occupancy: number;
  current_projected_occupancy: number;
  suggested_average_rate_cents: number;
  market_average_rate_cents: number;
  rate_change_percent: number;
  projected_revenue_cents: number;
  confidence: number;
  game_plan: string[];
  browser_evidence: BrowserEvidence;
  nights: TargetOccupancyNight[];
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

export type AccountProfileResponse = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  company_name: string | null;
  job_title: string | null;
  timezone: string;
  locale: string;
  notification_email: string | null;
  marketing_opt_in: boolean;
  profile_completed_at: string | null;
  clerk_user_id: string | null;
  default_organization_id: string | null;
  created_at: string;
  updated_at: string;
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
