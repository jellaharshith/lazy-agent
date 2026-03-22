import { Router, Request, Response } from "express";
import { optionalAuth } from "../middleware/auth";
import { createMatch } from "../db/matches";
import { classifyNeed } from "../services/aiService";
import { createNeedFromInput, markNeedMatched } from "../services/needService";
import { findBestResourceForNeed } from "../services/matchService";
import { listAvailableResources } from "../services/resourceService";
import type { ClassifiedNeed } from "../services/aiService";
import type { Match, Need, Resource } from "../types";

const router = Router();

const NO_RESOURCE_MESSAGE =
  "We detected your need, but no nearby resource is available.";
const NO_RESOURCE_SUMMARY = "Need detected but no match found.";

function matchedCopy(needType: string): { message: string; summary: string } {
  const t = needType.toLowerCase();
  if (t === "food") {
    return {
      message: "We found a meal available nearby.",
      summary: "Food need detected and matched to a nearby resource.",
    };
  }
  if (t === "financial") {
    return {
      message: "We found a resource that may help with financial needs nearby.",
      summary: "Financial need detected and matched to a nearby resource.",
    };
  }
  if (t === "emotional") {
    return {
      message: "We found support available nearby.",
      summary: "Emotional need detected and matched to a nearby resource.",
    };
  }
  return {
    message: "We found an available resource nearby.",
    summary: "Need detected and matched to a nearby resource.",
  };
}

const MATCH_SAVE_FAILED_MESSAGE =
  "We found a possible match but couldn't save it. Your need is on file.";
const MATCH_SAVE_FAILED_SUMMARY =
  "Need recorded; match could not be completed in the system.";

/** Demo-facing shape (flattened from matched resource + distance). */
type BestMatchView = {
  title: string;
  quantity: number;
  distanceKm: number;
  expiresAt: string | null;
  location: { lat: number; lng: number };
};

type BestMatchPayload = BestMatchView | null;

/** `findBestResourceForNeed` only returns resources with lat/lng. */
function flattenBestMatch(best: {
  resource: Resource;
  distanceKm: number;
}): BestMatchView {
  const r = best.resource;
  return {
    title: r.title,
    quantity: r.quantity ?? 0,
    distanceKm: best.distanceKm,
    expiresAt: r.expires_at,
    location: { lat: r.lat!, lng: r.lng! },
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
          "POST /api/intake — body: { raw_text: string, lat: number, lng: number }",
      },
    });
  } catch (err) {
    console.error("[GET /api/intake]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.post("/", optionalAuth, async (req: Request, res: Response) => {
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

    const classification = await classifyNeed(text);
    console.log("[POST /api/intake] classification result:", JSON.stringify(classification));

    const userId = req.user?.id ?? null;
    const need = await createNeedFromInput(
      text,
      {
        need_type: classification.need_type,
        urgency: classification.urgency,
        confidence: classification.confidence,
      },
      latNum,
      lngNum,
      userId
    );
    console.log("[POST /api/intake] need created:", JSON.stringify(need));

    let resources: Resource[] = [];
    try {
      resources = await listAvailableResources();
      console.log("[POST /api/intake] resources fetched, count:", resources.length);
    } catch (fetchErr) {
      console.error("[POST /api/intake] resources fetch failed (need preserved):", fetchErr);
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

    const best = findBestResourceForNeed(need, resources);
    console.log(
      "[POST /api/intake] best match selected:",
      best ? JSON.stringify(best) : "null"
    );

    if (!best) {
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

    const bestMatchView = flattenBestMatch(best);

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

      const { message, summary } = matchedCopy(classification.need_type);
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
