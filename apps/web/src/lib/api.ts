import "server-only";

import { demoMarketRates, demoProperty } from "@/lib/demo-data";
import { MarketRatesResponse, PropertyResponse } from "@/lib/types";

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

export async function getMarketRates(propertyId = demoProperty.id): Promise<MarketRatesResponse> {
  try {
    return await apiFetch<MarketRatesResponse>(`/properties/${propertyId}/market-rates`, {
      next: { revalidate: 45 },
    });
  } catch {
    return demoMarketRates;
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

export { ORG_ID };
