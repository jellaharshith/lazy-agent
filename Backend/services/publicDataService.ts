/**
 * Public, lightweight data helpers (OpenStreetMap Nominatim + demo seed payloads).
 * No private scraping — only OSM’s public search API with a proper User-Agent.
 */

export type OsmFoodPlaceType = "food_bank" | "community_kitchen" | "restaurant" | "supermarket";

export type OsmFoodPlace = {
  name: string;
  lat: number;
  lng: number;
  address: string;
  type: OsmFoodPlaceType;
};

export type MockSurplusResource = {
  title: string;
  quantity: number;
  expires_at: string;
  lat: number;
  lng: number;
  type: string;
};

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
/** Be polite to OSM: ~1 request per second. */
const NOMINATIM_GAP_MS = 1100;
const USER_AGENT = "LazyAgentSurplusFood/1.0 (hackathon demo; +https://example.com/contact)";

type NominatimHit = {
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  place_id?: number | string;
  osm_id?: number;
  osm_type?: string;
};

const QUERIES: { q: string; type: OsmFoodPlaceType }[] = [
  { q: "food bank", type: "food_bank" },
  { q: "community kitchen", type: "community_kitchen" },
  { q: "restaurant", type: "restaurant" },
  { q: "supermarket", type: "supermarket" },
];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function viewboxFor(lat: number, lng: number, delta = 0.07): string {
  const left = lng - delta;
  const top = lat + delta;
  const right = lng + delta;
  const bottom = lat - delta;
  return `${left},${top},${right},${bottom}`;
}

function dedupeKey(hit: NominatimHit, lat: number, lng: number): string {
  if (hit.osm_type != null && hit.osm_id != null) {
    return `${hit.osm_type}:${hit.osm_id}`;
  }
  if (hit.place_id != null) return `pid:${hit.place_id}`;
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

const TYPE_RANK: Record<OsmFoodPlaceType, number> = {
  food_bank: 0,
  community_kitchen: 1,
  restaurant: 2,
  supermarket: 3,
};

/**
 * Nearby-ish food-related places from OSM Nominatim (bounded search around lat/lng).
 */
export async function getOpenStreetMapFoodPlaces(lat: number, lng: number): Promise<OsmFoodPlace[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

  const merged = new Map<string, OsmFoodPlace>();
  const vb = viewboxFor(lat, lng);

  for (let i = 0; i < QUERIES.length; i++) {
    const { q, type } = QUERIES[i];
    if (i > 0) await sleep(NOMINATIM_GAP_MS);

    const url = new URL(NOMINATIM_BASE);
    url.searchParams.set("format", "json");
    url.searchParams.set("q", q);
    url.searchParams.set("viewbox", vb);
    url.searchParams.set("bounded", "1");
    url.searchParams.set("limit", "6");

    try {
      const res = await fetch(url.toString(), {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      });
      if (!res.ok) {
        console.warn("[publicDataService] Nominatim HTTP", res.status, q);
        continue;
      }
      const data = (await res.json()) as NominatimHit[];
      if (!Array.isArray(data)) continue;

      for (const hit of data) {
        const la = hit.lat != null ? Number(hit.lat) : NaN;
        const ln = hit.lon != null ? Number(hit.lon) : NaN;
        if (!Number.isFinite(la) || !Number.isFinite(ln)) continue;

        const key = dedupeKey(hit, la, ln);
        const name = (hit.name ?? hit.display_name ?? "Unknown").split(",")[0].trim() || "Unknown";
        const address = (hit.display_name ?? "").trim();

        const row: OsmFoodPlace = {
          name,
          lat: la,
          lng: ln,
          address,
          type,
        };

        const existing = merged.get(key);
        if (!existing || TYPE_RANK[type] < TYPE_RANK[existing.type]) {
          merged.set(key, row);
        }
      }
    } catch (e) {
      console.warn("[publicDataService] Nominatim fetch failed:", q, e);
    }
  }

  return [...merged.values()];
}

/** Demo surplus listings around Hayward / East Bay (not real inventory). */
export function getMockSurplusData(): MockSurplusResource[] {
  const days = (n: number) =>
    new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

  return [
    {
      title: "Hayward Community Kitchen — hot lunch trays",
      quantity: 42,
      expires_at: days(1),
      lat: 37.6688,
      lng: -122.0808,
      type: "community_kitchen",
    },
    {
      title: "All Saints Episcopal — weekend pantry boxes",
      quantity: 28,
      expires_at: days(2),
      lat: 37.6721,
      lng: -122.0863,
      type: "food_bank",
    },
    {
      title: "La Michoacana Bakery — day-old pan dulce",
      quantity: 36,
      expires_at: days(0.5),
      lat: 37.6612,
      lng: -122.0755,
      type: "bakery",
    },
    {
      title: "Mission Blvd Grocery — near-code produce bundles",
      quantity: 18,
      expires_at: days(1),
      lat: 37.655,
      lng: -122.07,
      type: "grocery",
    },
    {
      title: "Taco Libre — unserved catering rice & beans",
      quantity: 24,
      expires_at: days(0.25),
      lat: 37.676,
      lng: -122.095,
      type: "restaurant",
    },
    {
      title: "San Lorenzo Family Harvest — pantry dry goods",
      quantity: 55,
      expires_at: days(3),
      lat: 37.681,
      lng: -122.124,
      type: "food_bank",
    },
    {
      title: "Castro Valley Hope Kitchen — dinner service surplus",
      quantity: 30,
      expires_at: days(1),
      lat: 37.694,
      lng: -122.086,
      type: "community_kitchen",
    },
    {
      title: "Ashland Market — bakery markdown loaves",
      quantity: 22,
      expires_at: days(0.5),
      lat: 37.6945,
      lng: -122.114,
      type: "bakery",
    },
    {
      title: "Union City Interfaith — family meal kits",
      quantity: 40,
      expires_at: days(2),
      lat: 37.596,
      lng: -122.043,
      type: "community_kitchen",
    },
    {
      title: "Fremont Warm Springs — grocery deli ends",
      quantity: 15,
      expires_at: days(1),
      lat: 37.548,
      lng: -121.98,
      type: "grocery",
    },
    {
      title: "Downtown Hayward Taqueria — unsold burritos (veg)",
      quantity: 20,
      expires_at: days(0.2),
      lat: 37.6705,
      lng: -122.078,
      type: "restaurant",
    },
    {
      title: "Eden Area FRC — canned goods pallet",
      quantity: 120,
      expires_at: days(5),
      lat: 37.637,
      lng: -122.101,
      type: "food_bank",
    },
    {
      title: "Cherryland Community Café — soup gallons",
      quantity: 12,
      expires_at: days(0.5),
      lat: 37.679,
      lng: -122.103,
      type: "community_kitchen",
    },
    {
      title: "B Street Bagels — end-of-day dozens",
      quantity: 48,
      expires_at: days(0.3),
      lat: 37.667,
      lng: -122.088,
      type: "bakery",
    },
    {
      title: "South Hayward Safeway surplus (partner pilot)",
      quantity: 35,
      expires_at: days(1),
      lat: 37.642,
      lng: -122.087,
      type: "grocery",
    },
    {
      title: "Pho 84 — broth & noodles (event cancel)",
      quantity: 16,
      expires_at: days(0.15),
      lat: 37.6718,
      lng: -122.0825,
      type: "restaurant",
    },
    {
      title: "Newark Faith Pantry — mixed staples",
      quantity: 64,
      expires_at: days(4),
      lat: 37.53,
      lng: -122.04,
      type: "food_bank",
    },
    {
      title: "San Leandro Marina Deli — sandwich platters",
      quantity: 26,
      expires_at: days(0.4),
      lat: 37.724,
      lng: -122.185,
      type: "restaurant",
    },
    {
      title: "East Oakland Town Fridge refill — mixed",
      quantity: 14,
      expires_at: days(0.5),
      lat: 37.774,
      lng: -122.215,
      type: "community_kitchen",
    },
    {
      title: "Alameda South Shore — bakery samples bulk",
      quantity: 19,
      expires_at: days(1),
      lat: 37.763,
      lng: -122.252,
      type: "bakery",
    },
    {
      title: "Dublin Blvd Market — dairy approaching date",
      quantity: 27,
      expires_at: days(1),
      lat: 37.716,
      lng: -121.923,
      type: "grocery",
    },
    {
      title: "Pleasanton Pizza — unsold pies (cheese/pep)",
      quantity: 10,
      expires_at: days(0.25),
      lat: 37.662,
      lng: -121.875,
      type: "restaurant",
    },
    {
      title: "Berkeley Food Pantry — produce crates",
      quantity: 38,
      expires_at: days(2),
      lat: 37.87,
      lng: -122.268,
      type: "food_bank",
    },
    {
      title: "El Cerrito Plaza Deli — salad bowls",
      quantity: 17,
      expires_at: days(0.35),
      lat: 37.899,
      lng: -122.295,
      type: "restaurant",
    },
    {
      title: "San Mateo Hope — breakfast burritos",
      quantity: 33,
      expires_at: days(1),
      lat: 37.563,
      lng: -122.325,
      type: "community_kitchen",
    },
    {
      title: "Redwood City La Victoria — tamales unsold",
      quantity: 44,
      expires_at: days(0.5),
      lat: 37.485,
      lng: -122.228,
      type: "restaurant",
    },
    {
      title: "Fairfield Community Table — casserole pans",
      quantity: 21,
      expires_at: days(1),
      lat: 38.249,
      lng: -122.04,
      type: "community_kitchen",
    },
    {
      title: "Vallejo Waterfront Grocery — fruit bags",
      quantity: 31,
      expires_at: days(1),
      lat: 38.104,
      lng: -122.256,
      type: "grocery",
    },
    {
      title: "Concord Family Kitchen — pasta trays",
      quantity: 29,
      expires_at: days(0.6),
      lat: 37.978,
      lng: -122.031,
      type: "community_kitchen",
    },
  ];
}
