import "server-only";

const DEFAULT_LOCAL_API_BASE_URL = "http://localhost:8000";
const PRODUCTION_PRIVATE_API_URLS = [
  "http://api.railway.internal:8000",
  "http://rentalradar-api.railway.internal:8000",
  "http://rentalradarapi.railway.internal:8000",
];

export const ORG_ID = process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? "00000000-0000-0000-0000-000000000001";
export const USER_ID = process.env.NEXT_PUBLIC_USER_ID ?? "00000000-0000-0000-0000-000000000002";

export type BackendFetchOptions = RequestInit & {
  json?: unknown;
  next?: {
    revalidate?: number;
  };
};

export async function fetchBackend(path: string, options: BackendFetchOptions = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set("Accept", headers.get("Accept") ?? "application/json");
  headers.set("X-Organization-Id", headers.get("X-Organization-Id") ?? ORG_ID);
  headers.set("X-User-Id", headers.get("X-User-Id") ?? USER_ID);
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  let lastError: unknown;
  for (const baseUrl of backendBaseUrls()) {
    try {
      return await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
        body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
        cache: options.cache ?? (options.next ? undefined : "no-store"),
      });
    } catch (error) {
      lastError = error;
    }
  }

  const cause = lastError instanceof Error ? ` ${lastError.message}` : "";
  throw new Error(`Backend API is unreachable. Set API_BASE_URL for the web service.${cause}`);
}

function backendBaseUrls() {
  const configured = [process.env.API_BASE_URL, process.env.NEXT_PUBLIC_API_BASE_URL]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  const fallback =
    configured.length > 0
      ? []
      : process.env.NODE_ENV === "production"
        ? PRODUCTION_PRIVATE_API_URLS
        : [DEFAULT_LOCAL_API_BASE_URL];

  return [...new Set([...configured, ...fallback].map((value) => value.replace(/\/+$/, "")))];
}
