import type { SearchIntent } from "./aiService";
import type { Need, Resource } from "../types";
import type { OsmFoodPlace, OsmFoodPlaceType } from "./publicDataService";
import {
  calculateDistanceKm,
  computeCandidateRankScore,
  IntakePreferenceContext,
  pickFromRankedPool,
  preferenceRankBonus,
  resourceTypeTier,
  scoreResource,
} from "./matchService";

/** Google may still tag fast food; OSM uses the four public tiers. */
export type FoodPlaceType = OsmFoodPlaceType | "fast_food";

export type FoodPlace = Omit<OsmFoodPlace, "type"> & {
  type: FoodPlaceType;
  /** Where this candidate came from (for API + UI). */
  provenance: "google_places" | "osm";
};

const NEARBY_RADIUS_M = 5000;

export function placeTypeTier(t: FoodPlaceType): number {
  if (t === "food_bank") return 0;
  if (t === "community_kitchen") return 1;
  if (t === "restaurant" || t === "fast_food") return 2;
  return 3;
}

const TYPE_PRIORITY: Record<FoodPlaceType, number> = {
  food_bank: 0,
  community_kitchen: 1,
  restaurant: 2,
  fast_food: 2,
  supermarket: 3,
};

const KEYWORD_QUERIES: { keyword: string; type: FoodPlaceType }[] = [
  { keyword: "food bank", type: "food_bank" },
  { keyword: "community kitchen", type: "community_kitchen" },
  { keyword: "restaurant", type: "restaurant" },
  { keyword: "fast food", type: "fast_food" },
  { keyword: "supermarket", type: "supermarket" },
];

const PRIORITY_TO_QUERY: Record<string, { keyword: string; type: FoodPlaceType }> = {
  food_bank: { keyword: "food bank", type: "food_bank" },
  community_kitchen: { keyword: "community kitchen", type: "community_kitchen" },
  restaurant: { keyword: "restaurant", type: "restaurant" },
  fast_food: { keyword: "fast food", type: "fast_food" },
  supermarket: { keyword: "supermarket", type: "supermarket" },
  grocery_store: { keyword: "grocery store", type: "supermarket" },
};

function inferTypeFromKeyword(keyword: string): FoodPlaceType {
  const k = keyword.toLowerCase();
  if (k.includes("food bank") || k.includes("pantry")) return "food_bank";
  if (k.includes("community") || k.includes("soup kitchen")) return "community_kitchen";
  if (k.includes("fast food")) return "fast_food";
  if (k.includes("supermarket") || k.includes("grocery")) return "supermarket";
  if (k.includes("restaurant") || k.includes("cafe") || k.includes("indian") || k.includes("kitchen")) {
    return "restaurant";
  }
  return "restaurant";
}

function buildIntentQueries(intent: SearchIntent | null): { keyword: string; type: FoodPlaceType }[] {
  const out: { keyword: string; type: FoodPlaceType }[] = [...KEYWORD_QUERIES];
  const seen = new Set<string>();
  const add = (keyword: string, type: FoodPlaceType) => {
    const key = `${keyword.toLowerCase().trim()}|${type}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ keyword, type });
  };

  if (intent) {
    for (const pt of intent.priority_types) {
      const mapped = PRIORITY_TO_QUERY[pt];
      if (mapped) add(mapped.keyword, mapped.type);
    }
    for (const kw of intent.keywords) {
      const k = kw.trim();
      if (!k) continue;
      add(k, inferTypeFromKeyword(k));
    }
  }

  return out;
}

type NearbyJson = {
  status: string;
  results?: Array<{
    place_id?: string;
    name?: string;
    vicinity?: string;
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
};

type FoodPlaceInternal = FoodPlace & { place_id: string };

async function fetchNearbyForKeyword(
  lat: number,
  lng: number,
  keyword: string,
  type: FoodPlaceType,
  apiKey: string
): Promise<FoodPlaceInternal[]> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", String(NEARBY_RADIUS_M));
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const data = (await res.json()) as NearbyJson;
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.warn("[placesService] Places Nearby status:", data.status);
    return [];
  }

  const out: FoodPlaceInternal[] = [];
  for (const r of data.results ?? []) {
    const pid = r.place_id;
    const la = r.geometry?.location?.lat;
    const ln = r.geometry?.location?.lng;
    if (!pid || typeof la !== "number" || typeof ln !== "number") continue;

    out.push({
      place_id: pid,
      name: r.name ?? "Unknown place",
      lat: la,
      lng: ln,
      address: (r.vicinity ?? r.formatted_address ?? "").trim(),
      type,
      provenance: "google_places",
    });
  }
  return out;
}

/**
 * Nearby food-related places from Google Places (Nearby Search), deduped by place_id.
 * Returns [] if the key is missing or any failure (caller uses Supabase only).
 */
export async function getNearbyFoodPlacesForIntent(
  lat: number,
  lng: number,
  intent: SearchIntent | null
): Promise<FoodPlace[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn("[placesService] GOOGLE_MAPS_API_KEY is not set; skipping Places.");
    return [];
  }

  const queries = buildIntentQueries(intent);

  try {
    const batches = await Promise.all(
      queries.map(({ keyword, type }) =>
        fetchNearbyForKeyword(lat, lng, keyword, type, apiKey).catch((err) => {
          console.warn("[placesService] keyword fetch failed:", keyword, err);
          return [] as FoodPlaceInternal[];
        })
      )
    );

    const merged = new Map<string, FoodPlaceInternal>();
    for (const row of batches.flat()) {
      const existing = merged.get(row.place_id);
      if (!existing || TYPE_PRIORITY[row.type] < TYPE_PRIORITY[existing.type]) {
        merged.set(row.place_id, row);
      }
    }

    return [...merged.values()].map(({ place_id: _id, ...rest }) => rest);
  } catch (err) {
    console.error("[placesService] getNearbyFoodPlacesForIntent failed:", err);
    return [];
  }
}

export async function getNearbyFoodPlaces(lat: number, lng: number): Promise<FoodPlace[]> {
  return getNearbyFoodPlacesForIntent(lat, lng, null);
}

/** Convert OSM hits into unified FoodPlace candidates. */
export function osmPlacesToFoodPlaces(places: OsmFoodPlace[]): FoodPlace[] {
  return places.map((p) => ({
    ...p,
    type: p.type === "restaurant" ? p.type : p.type,
    provenance: "osm" as const,
  }));
}

export type BestFoodSource =
  | {
      source: "supabase";
      resource: Resource;
      distanceKm: number;
      score: number;
    }
  | { source: "google_places"; place: FoodPlace; distanceKm: number }
  | { source: "osm"; place: FoodPlace; distanceKm: number };

const defaultPref: IntakePreferenceContext = {
  preferenceText: null,
  freeFoodPreferred: false,
  cheapFoodPreferred: false,
};

/**
 * Merge Supabase resources with OSM/Google-style places and pick one winner.
 */
export function pickBestFoodSource(
  need: Need,
  resources: Resource[],
  places: FoodPlace[],
  preference: IntakePreferenceContext | null
): BestFoodSource | null {
  if (need.lat == null || need.lng == null) return null;

  const pref = preference ?? defaultPref;

  type Cand =
    | { kind: "supabase"; resource: Resource; distanceKm: number }
    | { kind: "place"; place: FoodPlace; distanceKm: number };

  const scored: Array<{ item: Cand; rank: number }> = [];

  for (const r of resources) {
    if (r.lat == null || r.lng == null) continue;
    if (r.status !== "available") continue;
    if (r.quantity != null && r.quantity <= 0) continue;

    const distanceKm = calculateDistanceKm(need.lat, need.lng, r.lat, r.lng);
    let rank = computeCandidateRankScore({
      typeTier: resourceTypeTier(r),
      distanceKm,
      expiresAt: r.expires_at,
      isPlace: false,
      urgency: need.urgency,
    });
    rank += preferenceRankBonus(pref, {
      title: r.title,
      subtitle: `${r.resource_type ?? ""} ${r.category ?? ""}`,
      discountedPrice: r.discounted_price ?? null,
      originalPrice: r.original_price ?? null,
    });
    scored.push({
      item: { kind: "supabase", resource: r, distanceKm },
      rank,
    });
  }

  for (const p of places) {
    const distanceKm = calculateDistanceKm(need.lat, need.lng, p.lat, p.lng);
    let rank = computeCandidateRankScore({
      typeTier: placeTypeTier(p.type),
      distanceKm,
      expiresAt: null,
      isPlace: true,
      urgency: need.urgency,
    });
    rank += preferenceRankBonus(pref, {
      title: p.name,
      subtitle: p.address,
      discountedPrice: null,
      originalPrice: null,
    });
    scored.push({
      item: { kind: "place", place: p, distanceKm },
      rank,
    });
  }

  const picked = pickFromRankedPool(scored);
  if (!picked) return null;

  const best = picked.item;
  if (best.kind === "supabase") {
    return {
      source: "supabase",
      resource: best.resource,
      distanceKm: best.distanceKm,
      score: scoreResource(need.urgency, best.distanceKm, best.resource.expires_at),
    };
  }

  if (best.place.provenance === "google_places") {
    return { source: "google_places", place: best.place, distanceKm: best.distanceKm };
  }
  return { source: "osm", place: best.place, distanceKm: best.distanceKm };
}
