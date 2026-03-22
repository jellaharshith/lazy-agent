import { Router, Request, Response } from "express";
import { createMatch } from "../db/matches";
import {
  analyzeNeedWithContext,
  type ClassifiedNeed,
  type IntakeAiAnalysis,
  type IntakeStorageTags,
  type NearbyCandidateForAi,
} from "../services/aiService";
import {
  createNeedFromInput,
  markNeedMatched,
  type ClassifiedNeedInput,
} from "../services/needService";
import {
  getNearbyFoodPlaces,
  getNearbyFoodPlacesForIntent,
  mergeFoodPlaces,
  osmPlacesToFoodPlaces,
  pickBestFoodSource,
  type FoodPlace,
} from "../services/placesService";
import { calculateDistanceKm, resourceMatchKind } from "../services/matchService";
import {
  getOpenStreetMapFoodPlaces,
  type OsmFoodPlace,
} from "../services/publicDataService";
import { listAvailableResources } from "../services/resourceService";
import type { IntakePreferenceContext } from "../services/matchService";
import type { Match, Need, Resource } from "../types";
import { optionalAuth } from "../middleware/auth";

const router = Router();
router.use(optionalAuth);

/** Coerce AI `storage_tags` to DB-safe optional fields; omit anything invalid or empty. */
function safeFieldsFromStorageTags(tags: IntakeStorageTags): Partial<
  Pick<ClassifiedNeedInput, "category" | "request_label" | "priority_score" | "preference_text">
> {
  const out: Partial<
    Pick<ClassifiedNeedInput, "category" | "request_label" | "priority_score" | "preference_text">
  > = {};

  if (tags.category != null) {
    const c = typeof tags.category === "string" ? tags.category.trim() : String(tags.category).trim();
    if (c) out.category = c;
  }
  if (tags.request_label != null) {
    const r =
      typeof tags.request_label === "string" ? tags.request_label.trim() : String(tags.request_label).trim();
    if (r) out.request_label = r;
  }
  if (tags.priority_score != null) {
    const n =
      typeof tags.priority_score === "number" ? tags.priority_score : Number(tags.priority_score);
    if (Number.isFinite(n)) {
      out.priority_score = Math.round(n);
    }
  }
  if (tags.preference_text != null) {
    const p =
      typeof tags.preference_text === "string"
        ? tags.preference_text.trim()
        : String(tags.preference_text).trim();
    if (p) out.preference_text = p;
  }
  return out;
}

function buildNearbyCandidatesForAi(
  lat: number,
  lng: number,
  resources: Resource[],
  osmPlaces: OsmFoodPlace[],
  googlePlaces: FoodPlace[]
): NearbyCandidateForAi[] {
  const out: NearbyCandidateForAi[] = [];

  const resScored = resources
    .filter((r) => r.lat != null && r.lng != null && r.status === "available")
    .map((r) => ({ r, d: calculateDistanceKm(lat, lng, r.lat!, r.lng!) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 18);

  for (const { r, d } of resScored) {
    if (r.quantity != null && r.quantity <= 0) continue;
    out.push({
      title: r.title,
      type: resourceMatchKind(r),
      distanceKm: d,
      discountedPrice: r.discounted_price ?? null,
      originalPrice: r.original_price ?? null,
      expiresAt: r.expires_at,
      source: "supabase",
    });
  }

  const osmScored = [...osmPlaces]
    .map((p) => ({ p, d: calculateDistanceKm(lat, lng, p.lat, p.lng) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 8);

  for (const { p, d } of osmScored) {
    out.push({
      title: p.name,
      type: p.type,
      distanceKm: d,
      source: "osm",
    });
  }

  const gScored = [...googlePlaces]
    .map((p) => ({ p, d: calculateDistanceKm(lat, lng, p.lat, p.lng) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 6);

  for (const { p, d } of gScored) {
    out.push({
      title: p.name,
      type: p.type,
      distanceKm: d,
      source: "google_places",
    });
  }

  return out;
}

/** Only include AI metadata keys when values are present and safe (DB columns may be missing). */
function classifiedNeedFromAnalysis(analysis: IntakeAiAnalysis): ClassifiedNeedInput {
  const tags = analysis.storage_tags;
  const out: ClassifiedNeedInput = {
    need_type: analysis.need_type,
    urgency: analysis.urgency,
    confidence: analysis.confidence,
  };
  const safe = safeFieldsFromStorageTags(tags);
  if (safe.category !== undefined) out.category = safe.category;
  if (safe.request_label !== undefined) out.request_label = safe.request_label;
  if (safe.priority_score !== undefined) out.priority_score = safe.priority_score;
  if (safe.preference_text !== undefined) out.preference_text = safe.preference_text;
  return out;
}

const NO_RESOURCE_MESSAGE =
  "We detected your need, but no nearby resource is available.";
const NO_RESOURCE_SUMMARY = "Need detected but no match found.";

const MATCH_SAVE_FAILED_MESSAGE =
  "We found a possible match but couldn't save it. Your need is on file.";
const MATCH_SAVE_FAILED_SUMMARY =
  "Need recorded; match could not be completed in the system.";

/** Normalized pool entry for logging (Supabase + OSM + Google). */
type IntakeFoodCandidate = {
  source: "supabase" | "google_places" | "osm";
  title: string;
  lat: number;
  lng: number;
  type: string;
  quantity?: number;
  expiresAt?: string | null;
};

function normalizeIntakeFoodCandidates(
  resources: Resource[],
  osmPlaces: OsmFoodPlace[],
  googleCount: number
): IntakeFoodCandidate[] {
  const out: IntakeFoodCandidate[] = [];
  for (const r of resources) {
    if (r.lat == null || r.lng == null) continue;
    if (r.status !== "available") continue;
    if (r.quantity != null && r.quantity <= 0) continue;
    out.push({
      source: "supabase",
      title: r.title,
      lat: r.lat,
      lng: r.lng,
      type: resourceMatchKind(r),
      quantity: r.quantity ?? undefined,
      expiresAt: r.expires_at,
    });
  }
  for (const p of osmPlaces) {
    out.push({
      source: "osm",
      title: p.name,
      lat: p.lat,
      lng: p.lng,
      type: p.type,
      expiresAt: null,
    });
  }
  if (googleCount > 0) {
    out.push({
      source: "google_places",
      title: `[${googleCount} Google Places candidates]`,
      lat: 0,
      lng: 0,
      type: "google_places",
      expiresAt: null,
    });
  }
  return out;
}

/** Demo-facing shape (flattened from matched resource + distance). */
type BestMatchView = {
  title: string;
  type: string;
  quantity: number;
  originalPrice?: number | null;
  discountedPrice?: number | null;
  distanceKm: number;
  expiresAt: string | null;
  source: "supabase" | "google_places" | "osm";
  rating?: number | null;
  location: { lat: number; lng: number };
  resourceId?: string | null;
};

type BestMatchPayload = BestMatchView | null;

function flattenBestMatchSupabase(best: {
  resource: Resource;
  distanceKm: number;
}): BestMatchView {
  const r = best.resource;
  return {
    title: r.title,
    type: resourceMatchKind(r),
    quantity: r.quantity ?? 0,
    originalPrice: r.original_price ?? null,
    discountedPrice: r.discounted_price ?? null,
    distanceKm: best.distanceKm,
    expiresAt: r.expires_at,
    source: "supabase",
    rating: null,
    location: { lat: r.lat!, lng: r.lng! },
    resourceId: r.id,
  };
}

function flattenBestMatchPlace(
  place: { name: string; lat: number; lng: number; type: string },
  distanceKm: number,
  source: "google_places" | "osm"
): BestMatchView {
  return {
    title: place.name,
    type: place.type,
    quantity: 0,
    originalPrice: null,
    discountedPrice: null,
    distanceKm,
    expiresAt: null,
    source,
    rating: null,
    location: { lat: place.lat, lng: place.lng },
    resourceId: null,
  };
}

function sendIntakeSuccess(
  res: Response,
  body: {
    raw_text: string;
    classification: ClassifiedNeed;
    need: Need;
    bestMatch: BestMatchPayload;
    match: Match | null;
    message: string;
    summary: string;
  }
): void {
  res.status(201).json({ success: true, ...body });
}

router.get("/", (_req: Request, res: Response) => {
  try {
    res.status(200).json({
      message: "Intake API",
      usage: {
        intake:
          "POST /api/intake — body: { raw_text: string, lat: number, lng: number }; optional Authorization: Bearer",
      },
    });
  } catch (err) {
    console.error("[GET /api/intake]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { raw_text, lat, lng } = req.body ?? {};

    if (typeof raw_text !== "string" || !raw_text.trim()) {
      return res.status(400).json({ error: "raw_text is required" });
    }

    const text = raw_text.trim();
    console.log("[POST /api/intake] raw_text received:", text);

    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return res.status(400).json({ error: "lat and lng must be finite numbers" });
    }

    let resources: Resource[] = [];
    try {
      resources = await listAvailableResources();
      console.log("[POST /api/intake] resources fetched, count:", resources.length);
    } catch (fetchErr) {
      console.error(
        "[POST /api/intake] resources fetch failed (continuing with places-only context):",
        fetchErr
      );
    }

    let osmPlaces: OsmFoodPlace[] = [];
    try {
      osmPlaces = await getOpenStreetMapFoodPlaces(latNum, lngNum);
      console.log("[POST /api/intake] OSM places count:", osmPlaces.length);
    } catch (osmErr) {
      console.error(
        "[POST /api/intake] OpenStreetMap (Nominatim) failed; using other sources only:",
        osmErr
      );
    }

    let googleInitial: FoodPlace[] = [];
    try {
      googleInitial = await getNearbyFoodPlaces(latNum, lngNum);
      console.log("[POST /api/intake] Google Places (initial) count:", googleInitial.length);
    } catch (gErr) {
      console.error("[POST /api/intake] Google Places (initial) failed; continuing:", gErr);
    }

    const nearbyCandidates = buildNearbyCandidatesForAi(
      latNum,
      lngNum,
      resources,
      osmPlaces,
      googleInitial
    );
    console.log("[POST /api/intake] candidates passed to AI:", nearbyCandidates.length);

    const analysis = await analyzeNeedWithContext({
      rawText: text,
      lat: latNum,
      lng: lngNum,
      nearbyCandidates,
    });

    const classification: ClassifiedNeed = {
      need_type: analysis.need_type,
      urgency: analysis.urgency,
      confidence: analysis.confidence,
      source: analysis.source,
    };

    const userId = req.user?.id ?? null;

    const needInput = classifiedNeedFromAnalysis(analysis);
    const storagePreview = {
      category: analysis.storage_tags.category,
      request_label:
        analysis.storage_tags.request_label != null &&
        String(analysis.storage_tags.request_label).length > 80
          ? `${String(analysis.storage_tags.request_label).slice(0, 80)}…`
          : analysis.storage_tags.request_label,
      priority_score: analysis.storage_tags.priority_score,
      preference_text:
        analysis.storage_tags.preference_text != null &&
        String(analysis.storage_tags.preference_text).length > 120
          ? `${String(analysis.storage_tags.preference_text).slice(0, 120)}…`
          : analysis.storage_tags.preference_text,
    };
    console.log(
      "[POST /api/intake] need create payload (keys + preview):",
      JSON.stringify({
        keys: Object.keys(needInput),
        need_type: needInput.need_type,
        urgency: needInput.urgency,
        confidence: needInput.confidence,
        has_category: needInput.category != null,
        has_request_label: needInput.request_label != null,
        has_priority_score: needInput.priority_score != null,
        has_preference_text: needInput.preference_text != null,
        has_user_id: userId != null,
        raw_text_len: text.length,
        lat: latNum,
        lng: lngNum,
        storage_tags_preview: storagePreview,
        optional_fields_passed_through: safeFieldsFromStorageTags(analysis.storage_tags),
      })
    );

    let need: Need;
    try {
      need = await createNeedFromInput(text, needInput, latNum, lngNum, userId);
    } catch (needErr) {
      const msg = needErr instanceof Error ? needErr.message : String(needErr);
      console.error("[POST /api/intake] createNeedFromInput failed:", msg);
      console.error(
        "[POST /api/intake] createNeedFromInput failed (payload debug):",
        JSON.stringify({
          need_type: needInput.need_type,
          urgency: needInput.urgency,
          confidence: needInput.confidence,
          keys: Object.keys(needInput),
          has_optional_ai_fields: {
            category: needInput.category != null,
            request_label: needInput.request_label != null,
            priority_score: needInput.priority_score != null,
            preference_text: needInput.preference_text != null,
          },
          has_user_id: userId != null,
        })
      );
      if (needErr instanceof Error && needErr.stack) {
        console.error("[POST /api/intake] createNeedFromInput stack:", needErr.stack);
      }
      throw needErr;
    }
    console.log("[POST /api/intake] need created:", JSON.stringify(need));

    const pref: IntakePreferenceContext = {
      preferenceText:
        analysis.storage_tags.preference_text ?? analysis.search_intent.user_preference,
      freeFoodPreferred: analysis.search_intent.free_food_preferred,
      cheapFoodPreferred: analysis.search_intent.cheap_food_preferred,
      rankingHints: analysis.ranking_hints,
      nearbyRequired: analysis.search_intent.nearby_required,
      cuisinePreference: analysis.search_intent.cuisine_preference,
    };

    const message = analysis.ui_content.message;
    const summary = analysis.ui_content.summary;

    let googleRefined: FoodPlace[] = [];
    try {
      googleRefined = await getNearbyFoodPlacesForIntent(latNum, lngNum, analysis.search_intent);
      console.log("[POST /api/intake] Google Places (intent-refined) count:", googleRefined.length);
    } catch (gErr) {
      console.error("[POST /api/intake] Google Places (intent-refined) failed; continuing:", gErr);
    }

    const googleMerged = mergeFoodPlaces(googleInitial, googleRefined);
    const osmFood = osmPlacesToFoodPlaces(osmPlaces);
    const mergedPlaces = [...googleMerged, ...osmFood];

    const candidatePool = normalizeIntakeFoodCandidates(resources, osmPlaces, googleMerged.length);
    console.log(
      "[POST /api/intake] merged candidate pool (supabase + osm + google meta):",
      candidatePool.length
    );

    const bestSource = pickBestFoodSource(need, resources, mergedPlaces, pref);
    if (bestSource) {
      const winner =
        bestSource.source === "supabase"
          ? { ranking_source: bestSource.source, title: bestSource.resource.title }
          : { ranking_source: bestSource.source, title: bestSource.place.name };
      console.log("[POST /api/intake] ranking winner:", JSON.stringify(winner));
    } else {
      console.log("[POST /api/intake] ranking winner: null");
    }

    if (!bestSource) {
      return sendIntakeSuccess(res, {
        raw_text: text,
        classification,
        need,
        bestMatch: null,
        match: null,
        message: NO_RESOURCE_MESSAGE,
        summary: NO_RESOURCE_SUMMARY,
      });
    }

    if (bestSource.source === "google_places" || bestSource.source === "osm") {
      const bestMatchView = flattenBestMatchPlace(
        bestSource.place,
        bestSource.distanceKm,
        bestSource.source
      );
      return sendIntakeSuccess(res, {
        raw_text: text,
        classification,
        need,
        bestMatch: bestMatchView,
        match: null,
        message,
        summary,
      });
    }

    const best = bestSource;
    const bestMatchView = flattenBestMatchSupabase({
      resource: best.resource,
      distanceKm: best.distanceKm,
    });

    try {
      const match = await createMatch({
        need_id: need.id,
        resource_id: best.resource.id,
        score: best.score,
        distance_km: best.distanceKm,
        status: "suggested",
      });
      console.log("[POST /api/intake] match created:", JSON.stringify(match));

      const updatedNeed = await markNeedMatched(need.id);
      console.log("[POST /api/intake] need status updated after match:", updatedNeed.status);

      return sendIntakeSuccess(res, {
        raw_text: text,
        classification,
        need: updatedNeed,
        bestMatch: bestMatchView,
        match,
        message,
        summary,
      });
    } catch (matchErr) {
      console.error(
        "[POST /api/intake] match creation failed (need preserved):",
        matchErr
      );
      const msg = matchErr instanceof Error ? matchErr.message : String(matchErr);
      console.error("[POST /api/intake] match error message:", msg);
      return sendIntakeSuccess(res, {
        raw_text: text,
        classification,
        need,
        bestMatch: bestMatchView,
        match: null,
        message: MATCH_SAVE_FAILED_MESSAGE,
        summary: MATCH_SAVE_FAILED_SUMMARY,
      });
    }
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/intake] failed:", err);
    console.error("[POST /api/intake] caught message:", details);
    if (err instanceof Error && err.stack) {
      console.error("[POST /api/intake] stack:", err.stack);
    }
    return res.status(500).json({
      error: "Intake failed",
      details,
    });
  }
});

export default router;
