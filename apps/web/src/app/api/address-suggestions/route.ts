import { NextResponse } from "next/server";

type AddressSuggestion = {
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

type PhotonFeature = {
  properties?: {
    osm_id?: number | string;
    housenumber?: string;
    name?: string;
    street?: string;
    city?: string;
    town?: string;
    district?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    countrycode?: string;
  };
  geometry?: {
    coordinates?: [number, number];
  };
};

type NominatimResult = {
  place_id?: number | string;
  osm_id?: number | string;
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: {
    house_number?: string;
    road?: string;
    pedestrian?: string;
    residential?: string;
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    state?: string;
    postcode?: string;
    country_code?: string;
  };
};

const USER_AGENT = "RentalRadar.ai address autocomplete (support@rentalradar.ai)";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = cleanQuery(searchParams.get("query") ?? "");
  const limit = clamp(Number(searchParams.get("limit") ?? 5), 1, 8);

  if (query.length < 3) {
    return NextResponse.json([]);
  }

  const [photon, nominatim] = await Promise.allSettled([
    fetchPhotonSuggestions(query, limit),
    fetchNominatimSuggestions(query, limit),
  ]);
  const suggestions = [
    ...(photon.status === "fulfilled" ? photon.value : []),
    ...(nominatim.status === "fulfilled" ? nominatim.value : []),
  ];

  return NextResponse.json(dedupeSuggestions(suggestions).slice(0, limit));
}

async function fetchPhotonSuggestions(query: string, limit: number): Promise<AddressSuggestion[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("lang", "en");

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!response.ok) return [];

  const payload = (await response.json()) as { features?: PhotonFeature[] };
  return (payload.features ?? [])
    .map(photonSuggestion)
    .filter((suggestion): suggestion is AddressSuggestion => Boolean(suggestion));
}

async function fetchNominatimSuggestions(query: string, limit: number): Promise<AddressSuggestion[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("countrycodes", "us");

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!response.ok) return [];

  const payload = (await response.json()) as NominatimResult[];
  return payload.map(nominatimSuggestion).filter((suggestion): suggestion is AddressSuggestion => Boolean(suggestion));
}

function photonSuggestion(feature: PhotonFeature): AddressSuggestion | null {
  const properties = feature.properties;
  const coordinates = feature.geometry?.coordinates;
  if (!properties || properties.countrycode !== "US") return null;

  const addressLine1 = [properties.housenumber, properties.street].filter(Boolean).join(" ") || properties.name || null;
  const city = properties.city || properties.town || properties.district || null;
  const formatted = [
    addressLine1,
    city,
    properties.state,
    properties.postcode,
    properties.country || "United States",
  ]
    .filter(Boolean)
    .join(", ");

  if (!formatted) return null;
  return {
    place_id: `photon-${properties.osm_id ?? formatted}`,
    formatted_address: formatted,
    address_line1: addressLine1,
    city,
    region: properties.state || null,
    postal_code: properties.postcode || null,
    country_code: "US",
    latitude: coordinates?.[1] ?? null,
    longitude: coordinates?.[0] ?? null,
  };
}

function nominatimSuggestion(item: NominatimResult): AddressSuggestion | null {
  const address = item.address ?? {};
  const addressLine1 =
    [address.house_number, address.road || address.pedestrian || address.residential].filter(Boolean).join(" ") || null;
  const city = address.city || address.town || address.village || address.hamlet || null;
  const formatted = item.display_name;
  const countryCode = (address.country_code || "us").toUpperCase();

  if (!formatted || countryCode !== "US") return null;
  return {
    place_id: `nominatim-${item.place_id ?? item.osm_id ?? formatted}`,
    formatted_address: formatted,
    address_line1: addressLine1,
    city,
    region: address.state || null,
    postal_code: address.postcode || null,
    country_code: countryCode,
    latitude: numberOrNull(item.lat),
    longitude: numberOrNull(item.lon),
  };
}

function dedupeSuggestions(suggestions: AddressSuggestion[]) {
  const seen = new Set<string>();
  const deduped: AddressSuggestion[] = [];
  for (const suggestion of suggestions) {
    const key = [suggestion.address_line1, suggestion.city, suggestion.region, suggestion.postal_code]
      .join("|")
      .toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(suggestion);
  }
  return deduped;
}

function cleanQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function numberOrNull(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
