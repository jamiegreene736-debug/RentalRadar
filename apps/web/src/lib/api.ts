import "server-only";

import {
  BillingSessionResponse,
  ErrorDashboardResponse,
  MarketRatesResponse,
  OtaDirectStatusResponse,
  PropertyResponse,
  ScrapingLegalNoticeResponse,
  UsageSummaryResponse,
} from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const ORG_ID = process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? "00000000-0000-0000-0000-000000000001";
const USER_ID = process.env.NEXT_PUBLIC_USER_ID ?? "00000000-0000-0000-0000-000000000002";

type ApiOptions = RequestInit & {
  json?: unknown;
  next?: {
    revalidate?: number;
  };
};

async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Organization-Id", ORG_ID);
  headers.set("X-User-Id", USER_ID);
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
    cache: options.cache ?? (options.next ? undefined : "no-store"),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API request failed: ${response.status}`);
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

export async function runPricing(propertyId: string) {
  return apiFetch("/pricing/recommendations/run", {
    method: "POST",
    json: { property_id: propertyId },
  });
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

export { ORG_ID };
