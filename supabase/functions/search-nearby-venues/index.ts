declare const Deno: {
  serve(handler: (request: Request) => Response | Promise<Response>): void;
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-ignore Deno resolves URL imports at deploy/runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.107.0";

type VenueCandidate = {
  provider: "google_places" | "foursquare" | "yelp" | "mock";
  providerPlaceId: string;
  name: string;
  category?: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  distanceMeters?: number;
  confidence?: number;
};

type RankedVenueCandidate = VenueCandidate & {
  source?: "stored" | "recent" | "foursquare";
  searchLabel?: string;
};

type RequestBody = {
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  query?: string;
};

type VenueRow = {
  provider: VenueCandidate["provider"];
  provider_place_id: string;
  name: string;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
};

type RecentVenueRow = {
  venue_provider: VenueCandidate["provider"] | null;
  venue_provider_place_id: string | null;
  venue_name: string | null;
  venue_category: string | null;
  venue_latitude: number | null;
  venue_longitude: number | null;
  venue_address: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const primaryFoursquareSearches = [
  { label: "nearby", radiusMeters: 600 },
  { label: "bar", query: "bar", radiusMeters: 800 },
  { label: "restaurant", query: "restaurant", radiusMeters: 900 },
  { label: "cafe", query: "cafe", radiusMeters: 900 },
  { label: "bistro", query: "bistro", radiusMeters: 900 },
  { label: "sports_bar", query: "sports bar", radiusMeters: 1000 },
  { label: "brewery", query: "brewery", radiusMeters: 1000 },
  { label: "pub", query: "pub", radiusMeters: 1000 },
  { label: "beer", query: "beer", radiusMeters: 1000 }
];
const foodFallbackSearches = [
  { label: "food", query: "food", radiusMeters: 900 },
  { label: "grill", query: "grill", radiusMeters: 900 }
];
const maxSearchRadiusMeters = 1000;
const blockedVenueNameTerms = ["conference room", "meeting room", "ballroom", "suite", "office"];
const strongBeerCategoryTerms = ["bar", "brewery", "pub", "taproom", "tavern", "beer garden", "beer hall", "biergarten", "sports bar", "gastropub"];
const foodVenueCategoryTerms = ["restaurant", "cafe", "bistro", "diner", "grill", "kitchen", "eatery", "pizzeria", "pizza", "taqueria"];
const usefulVenueCategoryTerms = ["lounge", "music venue", "event venue", "stadium", "arena"];
const beerSearchLabels = new Set(["bar", "sports_bar", "brewery", "pub", "beer"]);
const foodSearchLabels = new Set(["restaurant", "cafe", "bistro", "food", "grill"]);
const manualSearchRadiusMeters = 1200;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const requestedRadiusMeters = clampRadius(Number(body.radiusMeters));
  const manualQuery = typeof body.query === "string" ? body.query.trim().slice(0, 80) : "";

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return json({ error: "latitude and longitude are required." }, 400);
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const [storedVenues, recentVenues] = await Promise.all([
    searchStoredVenues({ latitude, longitude, radiusMeters: manualQuery ? manualSearchRadiusMeters : maxSearchRadiusMeters, authorization, query: manualQuery }),
    searchRecentConfirmedVenues({ latitude, longitude, radiusMeters: manualQuery ? manualSearchRadiusMeters : maxSearchRadiusMeters, authorization, query: manualQuery })
  ]);

  const foursquareKey = Deno.env.get("FOURSQUARE_API_KEY");
  const providerVenues = foursquareKey
    ? manualQuery
      ? await searchFoursquareByName({ latitude, longitude, apiKey: foursquareKey, query: manualQuery })
      : await searchFoursquare({ latitude, longitude, apiKey: foursquareKey })
    : [];
  const venues = mergeVenueCandidates([...recentVenues, ...storedVenues], providerVenues);
  console.log(
    `venue-search ll=${formatLl(latitude, longitude)} requested_radius=${requestedRadiusMeters} manual_query=${manualQuery ? "yes" : "no"} stored=${storedVenues.length} recent=${recentVenues.length} foursquare=${providerVenues.length} returned=${venues.length}`
  );

  if (!foursquareKey) {
    console.log(`venue-search provider=missing returned=${venues.length}`);
  }

  return json({ venues });
});

async function searchStoredVenues({
  latitude,
  longitude,
  radiusMeters,
  authorization,
  query
}: {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  authorization: string;
  query?: string;
}) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !authorization) return [];

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } }
  });
  const { latitudeDelta, longitudeDelta } = boundingBoxDeltas(latitude, radiusMeters);

  const { data, error } = await supabase
    .from("venues")
    .select("provider,provider_place_id,name,category,latitude,longitude,address,city,state,country")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .gte("latitude", latitude - latitudeDelta)
    .lte("latitude", latitude + latitudeDelta)
    .gte("longitude", longitude - longitudeDelta)
    .lte("longitude", longitude + longitudeDelta)
    .limit(25);

  if (error || !data) return [];

  const venues = (data as VenueRow[])
    .map((venue): RankedVenueCandidate | null => {
      if (!venue.provider || !venue.provider_place_id || !venue.name || typeof venue.latitude !== "number" || typeof venue.longitude !== "number") return null;
      const distanceMeters = distanceBetweenMeters(latitude, longitude, venue.latitude, venue.longitude);
      if (distanceMeters > radiusMeters) return null;
      return scoreVenue({
        provider: venue.provider,
        providerPlaceId: venue.provider_place_id,
        name: venue.name,
        category: venue.category ?? undefined,
        latitude: venue.latitude,
        longitude: venue.longitude,
        address: venue.address ?? undefined,
        city: venue.city ?? undefined,
        state: venue.state ?? undefined,
        country: venue.country ?? undefined,
        distanceMeters: Math.round(distanceMeters),
        source: "stored"
      });
    })
    .filter((venue: RankedVenueCandidate | null): venue is RankedVenueCandidate => Boolean(venue));

  return venues.filter((venue) => matchesVenueQuery(venue, query));
}

async function searchRecentConfirmedVenues({
  latitude,
  longitude,
  radiusMeters,
  authorization,
  query
}: {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  authorization: string;
  query?: string;
}) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !authorization) return [];

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } }
  });
  const { latitudeDelta, longitudeDelta } = boundingBoxDeltas(latitude, radiusMeters);
  const recentCutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();

  const { data, error } = await supabase
    .from("check_ins")
    .select("venue_provider,venue_provider_place_id,venue_name,venue_category,venue_latitude,venue_longitude,venue_address")
    .eq("venue_confirmation_status", "confirmed")
    .gte("created_at", recentCutoff)
    .not("venue_provider_place_id", "is", null)
    .not("venue_latitude", "is", null)
    .not("venue_longitude", "is", null)
    .gte("venue_latitude", latitude - latitudeDelta)
    .lte("venue_latitude", latitude + latitudeDelta)
    .gte("venue_longitude", longitude - longitudeDelta)
    .lte("venue_longitude", longitude + longitudeDelta)
    .limit(25);

  if (error || !data) return [];

  const venues = (data as RecentVenueRow[])
    .map((venue): RankedVenueCandidate | null => {
      if (!venue.venue_provider || !venue.venue_provider_place_id || !venue.venue_name || typeof venue.venue_latitude !== "number" || typeof venue.venue_longitude !== "number") return null;
      const distanceMeters = distanceBetweenMeters(latitude, longitude, venue.venue_latitude, venue.venue_longitude);
      if (distanceMeters > radiusMeters) return null;
      return scoreVenue({
        provider: venue.venue_provider,
        providerPlaceId: venue.venue_provider_place_id,
        name: venue.venue_name,
        category: venue.venue_category ?? undefined,
        latitude: venue.venue_latitude,
        longitude: venue.venue_longitude,
        address: venue.venue_address ?? undefined,
        distanceMeters: Math.round(distanceMeters),
        source: "recent"
      });
    })
    .filter((venue: RankedVenueCandidate | null): venue is RankedVenueCandidate => Boolean(venue));

  return venues.filter((venue) => matchesVenueQuery(venue, query));
}

async function searchFoursquare({
  latitude,
  longitude,
  apiKey
}: {
  latitude: number;
  longitude: number;
  apiKey: string;
}) {
  const [searchResults, foodFallbackResults] = await Promise.all([
    Promise.all(
      primaryFoursquareSearches.map((search) =>
        fetchFoursquarePlaces({
          latitude,
          longitude,
          radiusMeters: search.radiusMeters,
          apiKey,
          query: search.query,
          label: search.label
        })
      )
    ),
    Promise.all(
      foodFallbackSearches.map((search) =>
        fetchFoursquarePlaces({
          latitude,
          longitude,
          radiusMeters: search.radiusMeters,
          apiKey,
          query: search.query,
          label: search.label
        })
      )
    )
  ]);
  const primaryResults = searchResults.flat();
  return mergeVenueCandidates(primaryResults, foodFallbackResults.flat());
}

async function fetchFoursquarePlaces({
  latitude,
  longitude,
  radiusMeters,
  apiKey,
  query,
  label
}: {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  apiKey: string;
  query?: string;
  label: string;
}) {
  const url = new URL("https://places-api.foursquare.com/places/search");
  url.searchParams.set("ll", formatLl(latitude, longitude));
  url.searchParams.set("radius", String(radiusMeters));
  url.searchParams.set("limit", "10");
  if (query) url.searchParams.set("query", query);

  console.log(`foursquare-search request endpoint=/places/search ll=${formatLl(latitude, longitude)} radius=${radiusMeters} limit=10 query=${query ?? "none"}`);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: foursquareAuthorizationHeader(apiKey),
      "X-Places-Api-Version": "2025-06-17"
    }
  }).catch((error) => {
    console.warn(`foursquare-search label=${label} network_error=${errorMessage(error)}`);
    return null;
  });

  if (!response) return [];

  console.log(`foursquare-search response label=${label} status=${response.status}`);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.warn(`foursquare-search label=${label} status=${response.status} body=${errorBody.slice(0, 220)}`);
    return [];
  }

  const payload = await response.json().catch(() => ({ results: [] }));
  const results = Array.isArray(payload.results) ? payload.results : [];
  const venues = results
    .map((place: any): RankedVenueCandidate | null => {
      const category = place.categories?.[0]?.name;
      const lat = Number(place.latitude ?? place.geocodes?.main?.latitude);
      const lng = Number(place.longitude ?? place.geocodes?.main?.longitude);
      const address = place.location?.formatted_address ?? ([place.location?.address, place.location?.locality].filter(Boolean).join(", ") || undefined);
      const placeId = place.fsq_place_id ?? place.fsq_id;
      if (!placeId || !place.name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      if (isBlockedVenueName(place.name)) return null;
      return scoreVenue({
        provider: "foursquare",
        providerPlaceId: placeId,
        name: place.name,
        category,
        latitude: lat,
        longitude: lng,
        address,
        city: place.location?.locality,
        state: place.location?.region,
        country: place.location?.country,
        distanceMeters: typeof place.distance === "number" ? Math.round(place.distance) : Math.round(distanceBetweenMeters(latitude, longitude, lat, lng)),
        source: "foursquare",
        searchLabel: label
      });
    })
    .filter((venue: RankedVenueCandidate | null): venue is RankedVenueCandidate => Boolean(venue));

  console.log(`foursquare-search parsed label=${label} raw=${results.length} usable=${venues.length}`);
  return venues;
}

async function searchFoursquareByName({
  latitude,
  longitude,
  apiKey,
  query
}: {
  latitude: number;
  longitude: number;
  apiKey: string;
  query: string;
}) {
  if (query.length < 2) return [];
  return fetchFoursquarePlaces({
    latitude,
    longitude,
    radiusMeters: manualSearchRadiusMeters,
    apiKey,
    query,
    label: "manual"
  });
}

function scoreVenue(candidate: RankedVenueCandidate): RankedVenueCandidate {
  const distanceMeters = candidate.distanceMeters ?? maxSearchRadiusMeters;
  const distanceScore = Math.max(0, 1 - distanceMeters / maxSearchRadiusMeters) * 0.55;
  const categoryScore = categoryScoreFor(candidate.category);
  const historyScore = candidate.source === "recent" ? 0.18 : candidate.source === "stored" ? 0.12 : 0;
  const queryScore = candidate.searchLabel && beerSearchLabels.has(candidate.searchLabel) ? 0.14 : candidate.searchLabel && foodSearchLabels.has(candidate.searchLabel) ? 0.1 : 0;
  const confidence = Math.min(0.98, Number((distanceScore + categoryScore + historyScore + queryScore).toFixed(2)));
  return { ...candidate, confidence };
}

function categoryScoreFor(category?: string) {
  const normalized = category?.toLowerCase() ?? "";
  if (strongBeerCategoryTerms.some((term) => normalized.includes(term))) return 0.32;
  if (foodVenueCategoryTerms.some((term) => normalized.includes(term))) return 0.26;
  if (usefulVenueCategoryTerms.some((term) => normalized.includes(term))) return 0.18;
  return 0.04;
}

function mergeVenueCandidates(primary: RankedVenueCandidate[], fallback: RankedVenueCandidate[]) {
  const candidatesByKey = new Map<string, RankedVenueCandidate>();
  [...primary, ...fallback].forEach((candidate) => {
    const key = venueKey(candidate);
    const existing = candidatesByKey.get(key);
    if (!existing || rankScore(candidate) > rankScore(existing)) {
      candidatesByKey.set(key, candidate);
    }
  });
  return [...candidatesByKey.values()]
    .sort((a, b) => rankScore(b) - rankScore(a) || (a.distanceMeters ?? 9999) - (b.distanceMeters ?? 9999))
    .slice(0, 12)
    .map(({ source, searchLabel, ...venue }) => venue);
}

function rankScore(candidate: RankedVenueCandidate) {
  return candidate.confidence ?? 0;
}

function venueKey(candidate: VenueCandidate) {
  if (candidate.provider && candidate.providerPlaceId) return `${candidate.provider}:${candidate.providerPlaceId}`;
  return `${candidate.name.toLowerCase()}:${candidate.latitude.toFixed(4)}:${candidate.longitude.toFixed(4)}`;
}

function matchesVenueQuery(candidate: VenueCandidate, query?: string) {
  if (!query) return true;
  const normalizedQuery = query.toLowerCase();
  return [candidate.name, candidate.category, candidate.address].some((value) => value?.toLowerCase().includes(normalizedQuery));
}

function distanceBetweenMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusMeters = 6_371_000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function boundingBoxDeltas(latitude: number, radiusMeters: number) {
  return {
    latitudeDelta: radiusMeters / 111_320,
    longitudeDelta: radiusMeters / (111_320 * Math.max(0.2, Math.cos((latitude * Math.PI) / 180)))
  };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function clampRadius(value: number) {
  if (!Number.isFinite(value)) return 1000;
  return Math.max(100, Math.min(maxSearchRadiusMeters, Math.round(value)));
}

function foursquareAuthorizationHeader(apiKey: string) {
  const trimmed = apiKey.trim();
  return trimmed.toLowerCase().startsWith("bearer ") ? trimmed : `Bearer ${trimmed}`;
}

function formatLl(latitude: number, longitude: number) {
  return `${latitude},${longitude}`;
}

function isBlockedVenueName(name: string) {
  const normalized = name.toLowerCase();
  return blockedVenueNameTerms.some((term) => normalized.includes(term));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
