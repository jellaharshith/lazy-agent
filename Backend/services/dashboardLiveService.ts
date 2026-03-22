import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin, supabase } from "../config/supabase";

const LIST_LIMIT = 8;
const TREND_HOUR_WINDOWS = 4;
const TREND_SAMPLE_LIMIT = 400;
const HOUR_MS = 60 * 60 * 1000;

export interface LiveDashboardStats {
  foodAvailableCount: number;
  expiringSoonCount: number;
  savedCount: number;
  activeProvidersCount: number;
  activeReservationsCount: number;
}

export interface LiveAvailableItem {
  id: string;
  title: string;
  quantity: number;
  discountedPrice: number | null;
  expiresAt: string | null;
  status: string;
  providerName: string | null;
}

export interface LiveExpiringItem {
  id: string;
  title: string;
  quantity: number;
  discountedPrice: number | null;
  expiresAt: string | null;
  minutesLeft: number | null;
  status: string;
}

export interface LiveReservationItem {
  id: string;
  resourceTitle: string;
  createdAt: string;
  status: string;
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface LiveDashboardTrends {
  availableByHour: TrendPoint[];
  savedByHour: TrendPoint[];
  resourceTypeBreakdown: TrendPoint[];
  /** Present when a non-hourly derivation is used so the UI stays honest */
  availabilityCaption?: string;
  savedCaption?: string;
  breakdownCaption?: string;
}

export interface LiveDashboardPayload {
  stats: LiveDashboardStats;
  availableNow: LiveAvailableItem[];
  expiringSoon: LiveExpiringItem[];
  recentReservations: LiveReservationItem[];
  trends: LiveDashboardTrends;
}

function numQuantity(q: unknown): number {
  if (q === null || q === undefined) return 0;
  const n = Number(q);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function numPrice(p: unknown): number | null {
  if (p === null || p === undefined) return null;
  const n = Number(p);
  return Number.isFinite(n) ? n : null;
}

function minutesUntil(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((t - Date.now()) / 60_000));
}

function startOfLocalHour(d: Date): number {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  x.setSeconds(0, 0);
  x.setMilliseconds(0);
  return x.getTime();
}

function buildLocalHourBuckets(now: Date, n: number): { label: string; start: number; end: number }[] {
  const currentHourStart = startOfLocalHour(now);
  const out: { label: string; start: number; end: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = currentHourStart - i * HOUR_MS;
    const end = start + HOUR_MS;
    const label = new Date(start).toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
    out.push({ label, start, end });
  }
  return out;
}

function countsPerHourBuckets(isoList: string[], buckets: { label: string; start: number; end: number }[]): TrendPoint[] {
  const counts = buckets.map(() => 0);
  for (const iso of isoList) {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) continue;
    for (let i = 0; i < buckets.length; i++) {
      if (t >= buckets[i].start && t < buckets[i].end) {
        counts[i]++;
        break;
      }
    }
  }
  return buckets.map((b, i) => ({ label: b.label, value: counts[i] }));
}

function sumTrendPoints(series: TrendPoint[]): number {
  return series.reduce((s, p) => s + p.value, 0);
}

/** Buckets by how long ago each row was created (current snapshot, not clock-hour activity). */
function countsByAgeSinceCreated(isoList: string[], nowMs: number): TrendPoint[] {
  const bands: { label: string; minMs: number; maxMs: number | null }[] = [
    { label: "< 1h old", minMs: 0, maxMs: HOUR_MS },
    { label: "1–6h old", minMs: HOUR_MS, maxMs: 6 * HOUR_MS },
    { label: "6–24h old", minMs: 6 * HOUR_MS, maxMs: 24 * HOUR_MS },
    { label: "1d+ old", minMs: 24 * HOUR_MS, maxMs: null },
  ];
  const counts = bands.map(() => 0);
  for (const iso of isoList) {
    const created = new Date(iso).getTime();
    if (!Number.isFinite(created) || created > nowMs) continue;
    const age = nowMs - created;
    for (let i = 0; i < bands.length; i++) {
      const b = bands[i];
      const hi = b.maxMs === null ? Number.POSITIVE_INFINITY : b.maxMs;
      if (age >= b.minMs && age < hi) {
        counts[i]++;
        break;
      }
    }
  }
  return bands.map((b, i) => ({ label: b.label, value: counts[i] }));
}

function reservationStatusMix(activeReserved: number, savedTotal: number): TrendPoint[] {
  const confirmed = Math.max(0, savedTotal - activeReserved);
  return [
    { label: "Open holds", value: activeReserved },
    { label: "Confirmed", value: confirmed },
  ];
}

function aggregateResourceTypeBreakdown(
  rows: Array<{ category?: string | null; resource_type?: string | null }>,
  maxItems = 5
): TrendPoint[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const c = row.category?.trim();
    const t = row.resource_type?.trim();
    const label =
      c && c.length > 0 ? c : t && t.length > 0 ? t.replace(/_/g, " ") : "Other";
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length <= maxItems) {
    return sorted.map(([label, value]) => ({ label, value }));
  }
  const head = sorted.slice(0, maxItems - 1);
  const restSum = sorted.slice(maxItems - 1).reduce((s, [, v]) => s + v, 0);
  return [...head.map(([label, value]) => ({ label, value })), { label: "Other", value: restSum }];
}

export async function getLiveDashboardPayload(): Promise<LiveDashboardPayload> {
  const now = new Date();
  const nowIso = now.toISOString();
  const in3hIso = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();
  const trendWindowStartIso = new Date(now.getTime() - (TREND_HOUR_WINDOWS + 1) * HOUR_MS).toISOString();

  const dbPublic: SupabaseClient = supabase;
  const dbPriv: SupabaseClient = getSupabaseAdmin() ?? supabase;

  const hourBuckets = buildLocalHourBuckets(now, TREND_HOUR_WINDOWS);

  const [
    availCountRes,
    expiringCountRes,
    savedCountRes,
    activeResCountRes,
    availableRowsRes,
    expiringRowsRes,
    providersRes,
    trendAvailCreatedRes,
    trendSavedRes,
    trendTypeRes,
  ] = await Promise.all([
    dbPublic
      .from("resources")
      .select("*", { count: "exact", head: true })
      .eq("status", "available"),
    dbPublic
      .from("resources")
      .select("*", { count: "exact", head: true })
      .eq("status", "available")
      .not("expires_at", "is", null)
      .gt("expires_at", nowIso)
      .lte("expires_at", in3hIso),
    dbPriv
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .in("status", ["reserved", "confirmed"]),
    dbPriv.from("reservations").select("*", { count: "exact", head: true }).eq("status", "reserved"),
    dbPublic
      .from("resources")
      .select("id, title, quantity, discounted_price, expires_at, status, provider_id")
      .eq("status", "available")
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT),
    dbPublic
      .from("resources")
      .select("id, title, quantity, discounted_price, expires_at, status")
      .eq("status", "available")
      .not("expires_at", "is", null)
      .gt("expires_at", nowIso)
      .lte("expires_at", in3hIso)
      .order("expires_at", { ascending: true })
      .limit(LIST_LIMIT),
    dbPublic
      .from("resources")
      .select("provider_id")
      .eq("status", "available")
      .not("provider_id", "is", null),
    dbPublic
      .from("resources")
      .select("created_at")
      .eq("status", "available")
      .gte("created_at", trendWindowStartIso)
      .limit(TREND_SAMPLE_LIMIT),
    dbPriv
      .from("reservations")
      .select("created_at")
      .in("status", ["reserved", "confirmed"])
      .gte("created_at", trendWindowStartIso)
      .limit(TREND_SAMPLE_LIMIT),
    dbPublic
      .from("resources")
      .select("category, resource_type")
      .eq("status", "available")
      .limit(TREND_SAMPLE_LIMIT),
  ]);

  const foodAvailableCount = availCountRes.count ?? 0;
  const expiringSoonCount = expiringCountRes.count ?? 0;
  const savedCount = savedCountRes.count ?? 0;
  const activeReservationsCount = activeResCountRes.count ?? 0;

  const providerIds = Array.from(
    new Set(
      (providersRes.data ?? [])
        .map((r: { provider_id?: string | null }) => r.provider_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );
  const activeProvidersCount = providerIds.length;

  const profileById = new Map<string, string | null>();
  if (providerIds.length > 0) {
    const { data: profRows } = await dbPriv.from("profiles").select("id, full_name").in("id", providerIds);
    for (const row of profRows ?? []) {
      const id = row.id as string;
      const name = typeof row.full_name === "string" && row.full_name.trim() ? row.full_name.trim() : null;
      profileById.set(id, name);
    }
  }

  const availableRows = (availableRowsRes.data ?? []) as Array<{
    id: string;
    title: string;
    quantity: number | null;
    discounted_price?: number | null;
    expires_at: string | null;
    status: string;
    provider_id?: string | null;
  }>;

  const availableNow: LiveAvailableItem[] = availableRows.map((r) => ({
    id: r.id,
    title: r.title,
    quantity: numQuantity(r.quantity),
    discountedPrice: numPrice(r.discounted_price ?? null),
    expiresAt: r.expires_at,
    status: r.status,
    providerName: r.provider_id ? profileById.get(r.provider_id) ?? null : null,
  }));

  const expiringRows = (expiringRowsRes.data ?? []) as Array<{
    id: string;
    title: string;
    quantity: number | null;
    discounted_price?: number | null;
    expires_at: string | null;
    status: string;
  }>;

  const expiringSoon: LiveExpiringItem[] = expiringRows.map((r) => ({
    id: r.id,
    title: r.title,
    quantity: numQuantity(r.quantity),
    discountedPrice: numPrice(r.discounted_price ?? null),
    expiresAt: r.expires_at,
    minutesLeft: minutesUntil(r.expires_at),
    status: r.status,
  }));

  let recentReservations: LiveReservationItem[] = [];
  const resQ = await dbPriv
    .from("reservations")
    .select("id, status, created_at, resources(title)")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (resQ.error) {
    const fallback = await dbPriv
      .from("reservations")
      .select("id, status, created_at, resource_id")
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT);
    const rows = (fallback.data ?? []) as Array<{
      id: string;
      status: string;
      created_at: string;
      resource_id: string;
    }>;
    const ridSet = Array.from(new Set(rows.map((r) => r.resource_id).filter(Boolean)));
    const titleByRid = new Map<string, string>();
    if (ridSet.length > 0) {
      const { data: resRows } = await dbPublic.from("resources").select("id, title").in("id", ridSet);
      for (const rr of resRows ?? []) {
        titleByRid.set(rr.id as string, String((rr as { title?: string }).title ?? "Listing"));
      }
    }
    recentReservations = rows.map((r) => ({
      id: r.id,
      resourceTitle: titleByRid.get(r.resource_id) ?? "Unknown listing",
      createdAt: r.created_at,
      status: r.status,
    }));
  } else {
    const rows = (resQ.data ?? []) as Array<{
      id: string;
      status: string;
      created_at: string;
      resources: { title: string } | { title: string }[] | null;
    }>;
    recentReservations = rows.map((r) => {
      const res = r.resources;
      const title =
        Array.isArray(res) ? res[0]?.title : res?.title;
      return {
        id: r.id,
        resourceTitle: title ? String(title) : "Unknown listing",
        createdAt: r.created_at,
        status: r.status,
      };
    });
  }

  const availCreatedIso = (trendAvailCreatedRes.data ?? [])
    .map((r: { created_at?: string }) => r.created_at)
    .filter((s): s is string => typeof s === "string");
  const savedCreatedIso = (trendSavedRes.data ?? [])
    .map((r: { created_at?: string }) => r.created_at)
    .filter((s): s is string => typeof s === "string");

  const nowMs = now.getTime();

  let availableByHour = countsPerHourBuckets(availCreatedIso, hourBuckets);
  let availabilityCaption: string | undefined;
  if (sumTrendPoints(availableByHour) === 0 && foodAvailableCount > 0) {
    const { data: ageRows } = await dbPublic
      .from("resources")
      .select("created_at")
      .eq("status", "available")
      .order("created_at", { ascending: false })
      .limit(TREND_SAMPLE_LIMIT);
    const iso = (ageRows ?? [])
      .map((r: { created_at?: string }) => r.created_at)
      .filter((s): s is string => typeof s === "string");
    availableByHour = countsByAgeSinceCreated(iso, nowMs);
    availabilityCaption =
      "Current available listings by age since posted — nothing new in the last few clock hours.";
  }

  let savedByHour = countsPerHourBuckets(savedCreatedIso, hourBuckets);
  let savedCaption: string | undefined;
  if (sumTrendPoints(savedByHour) === 0 && savedCount > 0) {
    const { data: resAgeRows } = await dbPriv
      .from("reservations")
      .select("created_at")
      .in("status", ["reserved", "confirmed"])
      .order("created_at", { ascending: false })
      .limit(TREND_SAMPLE_LIMIT);
    const resIso = (resAgeRows ?? [])
      .map((r: { created_at?: string }) => r.created_at)
      .filter((s): s is string => typeof s === "string");
    if (resIso.length > 0) {
      savedByHour = countsByAgeSinceCreated(resIso, nowMs);
      savedCaption =
        "Saved bookings by age since created — none landed in the last few clock hours.";
    } else {
      savedByHour = reservationStatusMix(activeReservationsCount, savedCount);
      savedCaption =
        "Open vs confirmed counts now — timestamps aren’t visible with the current database access.";
    }
  }

  let resourceTypeBreakdown = aggregateResourceTypeBreakdown(
    (trendTypeRes.data ?? []) as Array<{ category?: string | null; resource_type?: string | null }>
  );
  let breakdownCaption: string | undefined;
  if (resourceTypeBreakdown.length === 0 && foodAvailableCount > 0) {
    resourceTypeBreakdown = [{ label: "Available surplus", value: foodAvailableCount }];
    breakdownCaption = "All current listings — category/type wasn’t set on the sampled rows.";
  }

  const trends: LiveDashboardTrends = {
    availableByHour,
    savedByHour,
    resourceTypeBreakdown,
    ...(availabilityCaption ? { availabilityCaption } : {}),
    ...(savedCaption ? { savedCaption } : {}),
    ...(breakdownCaption ? { breakdownCaption } : {}),
  };

  return {
    stats: {
      foodAvailableCount,
      expiringSoonCount,
      savedCount,
      activeProvidersCount,
      activeReservationsCount,
    },
    availableNow,
    expiringSoon,
    recentReservations,
    trends,
  };
}
