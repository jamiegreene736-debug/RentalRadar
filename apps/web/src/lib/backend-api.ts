import "server-only";

import { auth } from "@clerk/nextjs/server";
import { createHash } from "node:crypto";

const DEFAULT_LOCAL_API_BASE_URL = "http://localhost:8000";
const PRODUCTION_PRIVATE_API_URLS = [
  "http://api.railway.internal:8000",
  "http://rentalradar-api.railway.internal:8000",
  "http://rentalradarapi.railway.internal:8000",
];

const FALLBACK_ORG_ID = process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? "00000000-0000-0000-0000-000000000001";
const FALLBACK_USER_ID = process.env.NEXT_PUBLIC_USER_ID ?? "00000000-0000-0000-0000-000000000002";
const BACKEND_FETCH_TIMEOUT_MS = Number(process.env.BACKEND_FETCH_TIMEOUT_MS ?? 15000);

export const ORG_ID = FALLBACK_ORG_ID;
export const USER_ID = FALLBACK_USER_ID;

export type BackendFetchOptions = RequestInit & {
  json?: unknown;
  next?: {
    revalidate?: number;
  };
};

export async function fetchBackend(path: string, options: BackendFetchOptions = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set("Accept", headers.get("Accept") ?? "application/json");
  const authContext = await backendAuthContext();
  headers.set("X-Organization-Id", headers.get("X-Organization-Id") ?? authContext.organizationId);
  headers.set("X-User-Id", headers.get("X-User-Id") ?? authContext.userId);
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const { urls, warnings } = backendBaseUrls();
  let lastError: unknown;
  for (const baseUrl of urls) {
    try {
      return await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
        body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
        cache: options.cache ?? (options.next ? undefined : "no-store"),
        signal: options.signal ?? AbortSignal.timeout(BACKEND_FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      lastError = error;
    }
  }

  const cause = lastError instanceof Error ? ` ${lastError.message}` : "";
  const warning = warnings.length ? ` ${warnings.join(" ")}` : "";
  throw new Error(`Backend API is unreachable. Set API_BASE_URL to the backend service URL.${warning}${cause}`);
}

async function backendAuthContext() {
  try {
    const { orgId, userId } = await auth();
    if (userId) {
      return {
        organizationId: uuidOrDerive(orgId ?? userId, "organization"),
        userId: uuidOrDerive(userId, "user"),
      };
    }
  } catch {
    // Fall back below for local scripts, unauthenticated health checks, and tests.
  }

  return {
    organizationId: FALLBACK_ORG_ID,
    userId: FALLBACK_USER_ID,
  };
}

function uuidOrDerive(value: string, namespace: string) {
  const trimmed = value.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed;
  }
  const chars = createHash("sha256").update(`rentalradar:${namespace}:${trimmed}`).digest("hex").slice(0, 32).split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const hex = chars.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function backendBaseUrls() {
  const configured = [process.env.API_BASE_URL, process.env.NEXT_PUBLIC_API_BASE_URL]
    .map((value) => normalizeBackendBaseUrl(value))
    .filter((value): value is string => Boolean(value));
  const fallback =
    configured.length > 0
      ? []
      : process.env.NODE_ENV === "production"
        ? PRODUCTION_PRIVATE_API_URLS
        : [DEFAULT_LOCAL_API_BASE_URL];

  const warnings: string[] = [];
  const urls = [...new Set([...configured, ...fallback].map((value) => value.replace(/\/+$/, "")))].filter((url) => {
    if (!pointsToThisWebService(url)) return true;
    warnings.push("The configured API_BASE_URL points at this web service, not the FastAPI backend.");
    return false;
  });

  return { urls: urls.length ? urls : fallback, warnings };
}

function normalizeBackendBaseUrl(value?: string) {
  const trimmed = value?.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) return trimmed;

  const protocol = trimmed.includes(".railway.internal") || trimmed.includes("localhost") || trimmed.startsWith("127.")
    ? "http"
    : "https";
  return `${protocol}://${trimmed}`;
}

function pointsToThisWebService(baseUrl: string) {
  const webHosts = [
    process.env.RAILWAY_PUBLIC_DOMAIN,
    process.env.RAILWAY_STATIC_URL,
    process.env.RAILWAY_PRIVATE_DOMAIN,
    process.env.NEXT_PUBLIC_SITE_URL,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeHost(value));

  const backendHost = normalizeHost(baseUrl);
  return Boolean(backendHost && webHosts.includes(backendHost));
}

function normalizeHost(value: string) {
  try {
    return new URL(normalizeBackendBaseUrl(value) ?? value).host;
  } catch {
    return null;
  }
}
