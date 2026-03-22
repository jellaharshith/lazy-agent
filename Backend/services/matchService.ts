import { createMatch } from '../db/matches';
import { getAvailableResources } from '../db/resources';
import { Match, Need, Resource } from '../types';

const EARTH_RADIUS_KM = 6371;

const MAX_TYPE_TIER = 3;

/** Max random bump mixed into rank (keeps ordering from flipping wildly). */
const RANK_JITTER_MAX = 0.07;
/** Candidates within this score of the top are treated as “close” for diversity. */
const RANK_CLOSE_EPS = 18;
const RANK_POOL_MAX = 3;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function urgencyWeight(urgency: string): number {
  const u = urgency.toLowerCase();
  if (u === 'critical') return 1;
  if (u === 'high') return 0.85;
  if (u === 'medium') return 0.65;
  return 0.45;
}

/** Higher when closer to the need (inverse distance: near → ~1, far → ~0). */
export function inverseDistanceScore(distanceKm: number): number {
  if (!Number.isFinite(distanceKm)) return 0;
  if (distanceKm <= 1) return 1;
  if (distanceKm >= 30) return 0;
  return 1 - (distanceKm - 1) / 29;
}

export function expiryPriority(expiresAt: string | null): number {
  if (!expiresAt) return 0.6;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  const hours = ms / (1000 * 60 * 60);
  if (hours <= 6) return 1;
  if (hours <= 24) return 0.85;
  if (hours <= 72) return 0.65;
  return 0.5;
}

/** Haversine great-circle distance in kilometers. */
export function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((EARTH_RADIUS_KM * c).toFixed(2));
}

/**
 * Weighted score: urgency + inverse distance (closer is better) + expiry (sooner expiry = higher priority).
 */
export function scoreResource(urgency: string, distanceKm: number, expiresAt: string | null): number {
  const s =
    urgencyWeight(urgency) * 0.45 +
    inverseDistanceScore(distanceKm) * 0.4 +
    expiryPriority(expiresAt) * 0.15;
  return Number(s.toFixed(4));
}

/**
 * 0 = food bank, 1 = community kitchen, 2 = restaurant/bakery, 3 = supermarket/grocery.
 */
export function resourceTypeTier(r: Resource): number {
  const hay = `${r.title} ${r.resource_type}`.toLowerCase();
  if (hay.includes('food bank') || hay.includes('pantry')) return 0;
  if (hay.includes('community kitchen') || hay.includes('soup kitchen')) return 1;
  if (hay.includes('supermarket') || hay.includes('grocery')) return 3;
  if (
    hay.includes('restaurant') ||
    hay.includes('bakery') ||
    hay.includes('cafe') ||
    hay.includes('taqueria') ||
    hay.includes('deli')
  ) {
    return 2;
  }
  return 2;
}

/** UI / API label for a Supabase resource row. */
export function resourceMatchKind(
  r: Resource
): 'food_bank' | 'community_kitchen' | 'restaurant' | 'supermarket' {
  const hay = `${r.title} ${r.resource_type}`.toLowerCase();
  if (hay.includes('food bank') || hay.includes('pantry')) return 'food_bank';
  if (hay.includes('community kitchen') || hay.includes('soup kitchen')) return 'community_kitchen';
  if (hay.includes('supermarket') || hay.includes('grocery')) return 'supermarket';
  return 'restaurant';
}

/**
 * Higher = better. Type tier (food_bank … supermarket), distance, expiry, urgency, jitter.
 */
export function computeCandidateRankScore(opts: {
  typeTier: number;
  distanceKm: number;
  expiresAt: string | null;
  isPlace: boolean;
  urgency?: string;
}): number {
  const tier = Math.min(MAX_TYPE_TIER, Math.max(0, opts.typeTier));
  const typeScore = (MAX_TYPE_TIER - tier) * 100;
  const distScore = inverseDistanceScore(opts.distanceKm) * 75;
  const exp = opts.isPlace ? 0.55 : expiryPriority(opts.expiresAt);
  const expiryScore = exp * 30;
  const urgScore = opts.urgency ? urgencyWeight(opts.urgency) * 35 : 0;
  const jitter = Math.random() * RANK_JITTER_MAX;
  return typeScore + distScore + expiryScore + urgScore + jitter;
}

/** Deterministic boosts from AI ranking hints (intake). */
export type RankingHintsContext = {
  prioritize_distance: boolean;
  prioritize_low_price: boolean;
  prioritize_soon_expiring: boolean;
  prioritize_free_food: boolean;
};

/** Extra rank weight from cuisine / price preferences (intake). */
export type IntakePreferenceContext = {
  preferenceText: string | null;
  freeFoodPreferred: boolean;
  cheapFoodPreferred: boolean;
  rankingHints?: RankingHintsContext | null;
  nearbyRequired?: boolean;
  cuisinePreference?: string | null;
};

export function aiRankingHintBonus(opts: {
  hints: RankingHintsContext | null | undefined;
  nearbyRequired: boolean;
  distanceKm: number;
  expiresAt: string | null;
  isPlace: boolean;
  matchKind: string;
  discountedPrice?: number | null;
  originalPrice?: number | null;
}): number {
  let b = 0;
  const h = opts.hints;
  if (h?.prioritize_distance) {
    b += inverseDistanceScore(opts.distanceKm) * 22;
  }
  if (opts.nearbyRequired) {
    if (opts.distanceKm > 3) b -= (opts.distanceKm - 3) * 8;
    if (opts.distanceKm < 2) b += 12;
  }
  if (h?.prioritize_low_price) {
    const d = opts.discountedPrice;
    if (d != null && Number.isFinite(d)) {
      if (d <= 0) b += 28;
      else if (d <= 3) b += 20;
      else if (d <= 8) b += 10;
    }
  }
  if (h?.prioritize_soon_expiring && !opts.isPlace) {
    b += expiryPriority(opts.expiresAt) * 18;
  }
  if (h?.prioritize_free_food) {
    const k = opts.matchKind.toLowerCase();
    if (k.includes("food_bank") || k.includes("community")) b += 22;
    const d = opts.discountedPrice;
    if (d != null && Number.isFinite(d) && d <= 0) b += 18;
  }
  return b;
}

export function preferenceRankBonus(
  ctx: IntakePreferenceContext,
  opts: {
    title: string;
    subtitle?: string;
    discountedPrice?: number | null;
    originalPrice?: number | null;
  }
): number {
  let b = 0;
  const hay = `${opts.title} ${opts.subtitle ?? ""}`.toLowerCase();
  const pref = [ctx.preferenceText ?? "", ctx.cuisinePreference ?? ""]
    .join(" ")
    .toLowerCase()
    .trim();
  if (pref.length > 1) {
    for (const token of pref.split(/[^a-z0-9]+/)) {
      if (token.length > 2 && hay.includes(token)) b += 15;
    }
  }
  const disc = opts.discountedPrice;
  if (ctx.freeFoodPreferred && disc != null && Number.isFinite(disc) && disc <= 0) b += 25;
  if (ctx.cheapFoodPreferred && disc != null && Number.isFinite(disc) && disc > 0 && disc <= 5) b += 18;
  return b;
}

export function pickFromRankedPool<T>(
  scored: Array<{ item: T; rank: number }>
): { item: T; rank: number } | null {
  if (scored.length === 0) return null;
  const sorted = [...scored].sort((a, b) => b.rank - a.rank);
  const topScore = sorted[0].rank;
  const pool = sorted
    .filter((s) => s.rank >= topScore - RANK_CLOSE_EPS)
    .slice(0, RANK_POOL_MAX);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return pick;
}

/** Picks a resource with diversity among top close matches (not always the same row). */
export function findBestResourceForNeed(
  need: Need,
  resources: Resource[]
): { resource: Resource; score: number; distanceKm: number } | null {
  if (need.lat == null || need.lng == null) return null;

  const scored: Array<{
    item: { resource: Resource; distanceKm: number };
    rank: number;
  }> = [];

  for (const r of resources) {
    if (r.lat == null || r.lng == null) continue;
    if (r.status !== 'available') continue;
    if (r.quantity != null && r.quantity <= 0) continue;

    const distanceKm = calculateDistanceKm(need.lat, need.lng, r.lat, r.lng);
    const rank = computeCandidateRankScore({
      typeTier: resourceTypeTier(r),
      distanceKm,
      expiresAt: r.expires_at,
      isPlace: false,
      urgency: need.urgency,
    });
    scored.push({ item: { resource: r, distanceKm }, rank });
  }

  const picked = pickFromRankedPool(scored);
  if (!picked) return null;

  const { resource, distanceKm } = picked.item;
  return {
    resource,
    distanceKm,
    score: scoreResource(need.urgency, distanceKm, resource.expires_at),
  };
}

/** Fetches available rows from DB, scores by distance + urgency + expiry, inserts a suggested match. */
export async function createMatchForNeed(need: Need): Promise<Match | null> {
  const resources = await getAvailableResources();
  const best = findBestResourceForNeed(need, resources);
  if (!best) return null;

  return createMatch({
    need_id: need.id,
    resource_id: best.resource.id,
    score: best.score,
    distance_km: best.distanceKm,
    status: 'suggested',
  });
}
