/**
 * Seed `resources` with demo public-style surplus rows from getMockSurplusData().
 * Run: npm run seed:public  (from repo root)
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

import { createResource, listResourceTitleLocations } from "../db/resources";
import { getMockSurplusData } from "../services/publicDataService";

function locationKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function titleKey(title: string): string {
  return title.trim().toLowerCase();
}

async function main(): Promise<void> {
  const mock = getMockSurplusData();
  const existing = await listResourceTitleLocations();

  const seen = new Set<string>();
  for (const r of existing) {
    if (r.lat != null && r.lng != null) {
      seen.add(`${titleKey(r.title)}|${locationKey(r.lat, r.lng)}`);
    } else {
      seen.add(titleKey(r.title));
    }
  }

  let inserted = 0;
  for (const row of mock) {
    const key = `${titleKey(row.title)}|${locationKey(row.lat, row.lng)}`;
    if (seen.has(key)) {
      console.log("[seedPublicData] skip duplicate:", row.title);
      continue;
    }

    const created = await createResource({
      title: row.title,
      resource_type: row.type,
      quantity: row.quantity,
      expires_at: row.expires_at,
      lat: row.lat,
      lng: row.lng,
      status: "available",
    });
    seen.add(key);
    inserted += 1;
    console.log("[seedPublicData] inserted:", created.id, created.title);
  }

  console.log(`[seedPublicData] done. Inserted ${inserted} row(s), skipped ${mock.length - inserted}.`);
}

main().catch((e) => {
  console.error("[seedPublicData] failed:", e);
  process.exit(1);
});
