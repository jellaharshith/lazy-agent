import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { geocodeForward, geocodeReverse } from "../services/publicDataService";

const router = Router();

router.post("/forward", requireAuth, async (req: Request, res: Response) => {
  try {
    const { query } = req.body ?? {};
    if (typeof query !== "string" || !query.trim()) {
      return res.status(400).json({ error: "query is required" });
    }
    const result = await geocodeForward(query);
    if (!result) {
      return res.status(404).json({ error: "No location found for that address." });
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error("[POST /api/geocode/forward] failed:", err);
    const message = err instanceof Error ? err.message : "Geocoding failed";
    return res.status(500).json({ error: message });
  }
});

router.post("/reverse", requireAuth, async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.body ?? {};
    const la = Number(lat);
    const ln = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) {
      return res.status(400).json({ error: "lat and lng must be numbers" });
    }
    const result = await geocodeReverse(la, ln);
    if (!result) {
      return res.status(404).json({ error: "Could not resolve address for those coordinates." });
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error("[POST /api/geocode/reverse] failed:", err);
    const message = err instanceof Error ? err.message : "Reverse geocoding failed";
    return res.status(500).json({ error: message });
  }
});

export default router;
