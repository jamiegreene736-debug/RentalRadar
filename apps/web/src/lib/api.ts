import "server-only";

import {
  BillingSessionResponse,
  AccountProfileResponse,
  ErrorDashboardResponse,
  MarketScanResponse,
  MarketRatesResponse,
  OtaDirectStatusResponse,
  PropertyResponse,
  ScrapingLegalNoticeResponse,
  SeasonCalendarResponse,
  TargetOccupancyPlanResponse,
  UsageSummaryResponse,
} from "@/lib/types";
import { fetchBackend, ORG_ID, USER_ID } from "@/lib/backend-api";

type ApiOptions = RequestInit & {
  json?: unknown;
  next?: {
    revalidate?: number;
  };
};

async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetchBackend(path, options);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(readApiError(text) || `API request failed: ${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export async function createProperty(payload: {
  address: string;
  name?: string;
  bedrooms?: number;
  bathrooms?: number;
  sleeps?: number;
  base_price_cents?: number;
  min_price_cents?: number;
  max_price_cents?: number;
  comp_urls?: string[];
}) {
  return apiFetch<PropertyResponse>("/properties", {
    method: "POST",
    json: { scan_days: 90, ...payload },
  });
}

export async function getProperties(): Promise<PropertyResponse[]> {
  try {
    return await apiFetch<PropertyResponse[]>("/properties", {
      cache: "no-store",
    });
  } catch {
    return [];
  }
}

function readApiError(text: string) {
  if (!text) return "";
  try {
    const payload = JSON.parse(text) as { detail?: unknown; message?: unknown; error?: unknown };
    const detail = payload.detail ?? payload.message ?? payload.error;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && "msg" in item && typeof item.msg === "string") return item.msg;
          return null;
        })
        .filter(Boolean)
        .join(" ");
    }
  } catch {
    return text;
  }
  return text;
}

export async function getMarketRates(propertyId: string): Promise<MarketRatesResponse> {
  try {
    return await apiFetch<MarketRatesResponse>(`/properties/${propertyId}/market-rates`, {
      next: { revalidate: 45 },
    });
  } catch {
    return {
      property_id: propertyId,
      cached: false,
      observations: [],
      recommendations: [],
    };
  }
}

export async function buildTargetOccupancyPlan(
  propertyId: string,
  payload: {
    target_month: string;
    target_occupancy: number;
    refresh_browser_data?: boolean;
  },
): Promise<TargetOccupancyPlanResponse> {
  return apiFetch<TargetOccupancyPlanResponse>(`/properties/${propertyId}/target-occupancy-plan`, {
    method: "POST",
    json: { refresh_browser_data: true, ...payload },
  });
}

export async function runPricing(propertyId: string) {
  return apiFetch("/pricing/recommendations/run", {
    method: "POST",
    json: { property_id: propertyId },
  });
}

export async function queuePropertyMarketScan(propertyId: string): Promise<MarketScanResponse> {
  return apiFetch<MarketScanResponse>(`/properties/${propertyId}/market-scan`, {
    method: "POST",
  });
}

export async function getSeasonCalendar(propertyId: string): Promise<SeasonCalendarResponse | null> {
  try {
    return await apiFetch<SeasonCalendarResponse>(`/properties/${propertyId}/season-calendar`, {
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

export async function connectPms(payload: Record<string, unknown>) {
  return apiFetch("/pms/connect", {
    method: "POST",
    json: payload,
  });
}

export async function pushPricing(payload: Record<string, unknown>) {
  return apiFetch("/pricing/push", {
    method: "POST",
    json: payload,
  });
}

export async function connectDirectOta(payload: Record<string, unknown>) {
  return apiFetch("/ota/connect-direct", {
    method: "POST",
    json: payload,
  });
}

export async function submitDirectOta2fa(payload: Record<string, unknown>) {
  return apiFetch("/ota/2fa-submit", {
    method: "POST",
    json: payload,
  });
}

export async function pushDirectPricing(payload: Record<string, unknown>) {
  return apiFetch("/pricing/push-direct", {
    method: "POST",
    json: payload,
  });
}

export async function revokeDirectOta(credentialId: string) {
  return apiFetch(`/ota/direct/${credentialId}`, {
    method: "DELETE",
  });
}

export async function getOtaDirectStatus(): Promise<OtaDirectStatusResponse> {
  try {
    return await apiFetch<OtaDirectStatusResponse>("/ota/status", {
      next: { revalidate: 15 },
    });
  } catch {
    return {
      credentials: [],
      high_risk_notice:
        "This may violate platform TOS and risks account suspension. Use at your own risk. RentalRadar strongly recommends the Chrome/Safari extension or official PMS APIs instead.",
    };
  }
}

export async function createBillingCheckout(payload: { plan_code: string; property_quantity?: number }) {
  return apiFetch<BillingSessionResponse>("/billing/checkout", {
    method: "POST",
    json: { property_quantity: 1, ...payload },
  });
}

export async function getBillingUsage(): Promise<UsageSummaryResponse | null> {
  try {
    return await apiFetch<UsageSummaryResponse>("/billing/usage", {
      next: { revalidate: 30 },
    });
  } catch {
    return null;
  }
}

export async function getScrapingLegalNotice(): Promise<ScrapingLegalNoticeResponse> {
  try {
    return await apiFetch<ScrapingLegalNoticeResponse>("/legal/scraping-notice", {
      next: { revalidate: 3600 },
    });
  } catch {
    return {
      title: "Live market data and scraping notice",
      body: "RentalRadar is designed for authorized rate intelligence and channel operations. This notice is product guidance, not legal advice.",
      commitments: [
        "Prefer official PMS and channel APIs when available.",
        "Do not bypass paywalls, access controls, CAPTCHAs, or authentication barriers.",
        "Use rate limits, retries, and proxies to reduce service impact.",
      ],
      user_responsibilities: [
        "Connect only accounts and listings you are authorized to manage.",
        "Review third-party platform terms before enabling automated pulls or pushes.",
        "Validate recommendations before publishing rates to channels.",
      ],
    };
  }
}

export async function getErrorDashboard(): Promise<ErrorDashboardResponse | null> {
  try {
    return await apiFetch<ErrorDashboardResponse>("/ops/errors", {
      next: { revalidate: 30 },
    });
  } catch {
    return null;
  }
}

export async function getAccountProfile(): Promise<AccountProfileResponse | null> {
  try {
    return await apiFetch<AccountProfileResponse>("/account/profile", {
      next: { revalidate: 30 },
    });
  } catch {
    return null;
  }
}

export async function updateAccountProfile(payload: {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  company_name?: string;
  job_title?: string;
  timezone?: string;
  locale?: string;
  notification_email?: string;
  marketing_opt_in?: boolean;
  avatar_url?: string;
  clerk_user_id?: string;
}): Promise<AccountProfileResponse> {
  return apiFetch<AccountProfileResponse>("/account/profile", {
    method: "PATCH",
    json: payload,
  });
}

export { ORG_ID };
