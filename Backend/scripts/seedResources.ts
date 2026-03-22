/**
 * Seed many realistic East Bay / Hayward-area resource rows.
 * Run: npm run seed:resources  (from repo root)
 *
 * Idempotent: skips rows that already exist (same normalized title + lat/lng).
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

import type { CreateResourceInput } from "../types";
import { createResource, listResourceTitleLocations } from "../db/resources";
import { getHaywardResourceSeedRows } from "./data/haywardResourceSeedRows";

function locationKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function titleKey(title: string): string {
  return title.trim().toLowerCase();
}

/** Align DB titles like `[food_bank] Real name` with seed titles `Real name` for idempotent runs. */
function dedupeKeyFromTitle(title: string): string {
  const t = title.trim();
  const m = /^\[[a-z0-9_]+\]\s+(.+)/i.exec(t);
  return titleKey(m ? m[1]! : t);
}

function isMissingResourcesMarketplaceColumn(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("category") ||
    msg.includes("original_price") ||
    msg.includes("discounted_price") ||
    msg.includes("provider_id") ||
    msg.includes("schema cache")
  );
}

/** Inserts without optional marketplace columns (older DBs). Category folded into title for ranking heuristics. */
function legacyPayload(row: CreateResourceInput): CreateResourceInput {
  const cat = row.category?.trim();
  const title =
    cat && cat.length > 0 ? `[${cat}] ${row.title}`.trim() : row.title;
  return {
    title,
    resource_type: row.resource_type ?? "food",
    quantity: row.quantity ?? null,
    expires_at: row.expires_at ?? null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    status: row.status ?? "available",
  };
}

async function insertResourceRow(
  row: CreateResourceInput,
  mode: "full" | "legacy"
): Promise<{ id: string; title: string }> {
  if (mode === "legacy") {
    const created = await createResource(legacyPayload(row));
    return { id: created.id, title: created.title };
  }
  const created = await createResource({
    title: row.title,
    resource_type: row.resource_type ?? "food",
    category: row.category ?? null,
    quantity: row.quantity ?? null,
    original_price: row.original_price ?? null,
    discounted_price: row.discounted_price ?? null,
    expires_at: row.expires_at ?? null,
    lat: row.lat,
    lng: row.lng,
    status: row.status ?? "available",
    provider_id: row.provider_id ?? null,
  });
  return { id: created.id, title: created.title };
}

async function main(): Promise<void> {
  const rows = getHaywardResourceSeedRows();
  const existing = await listResourceTitleLocations();

  const seen = new Set<string>();
  for (const r of existing) {
    if (r.lat != null && r.lng != null) {
      seen.add(`${dedupeKeyFromTitle(r.title)}|${locationKey(r.lat, r.lng)}`);
    } else {
      seen.add(dedupeKeyFromTitle(r.title));
    }
  }

  let inserted = 0;
  let skipped = 0;
  let insertMode: "full" | "legacy" = "full";

  for (const row of rows) {
    if (row.lat == null || row.lng == null) {
      skipped += 1;
      continue;
    }
    const key = `${dedupeKeyFromTitle(row.title)}|${locationKey(row.lat, row.lng)}`;
    if (seen.has(key)) {
      skipped += 1;
      console.log("[seedResources] skip duplicate:", row.title.slice(0, 72));
      continue;
    }

    let created: { id: string; title: string };
    try {
      created = await insertResourceRow(row, insertMode);
    } catch (e) {
      if (insertMode === "full" && isMissingResourcesMarketplaceColumn(e)) {
        console.warn(
          "[seedResources] marketplace columns missing — switching to legacy inserts. After migration, run again for full rows: npm run db:apply-resource-marketplace"
        );
        insertMode = "legacy";
        created = await insertResourceRow(row, "legacy");
      } else {
        throw e;
      }
    }
    seen.add(key);
    inserted += 1;
    console.log("[seedResources] inserted:", created.id, created.title.slice(0, 60));
  }

  console.log(
    `[seedResources] done. Inserted ${inserted} row(s), skipped ${skipped} (duplicates or invalid). Seed file had ${rows.length} template row(s).`
  );
}

main().catch((e) => {
  console.error("[seedResources] failed:", e);
  process.exit(1);
});
