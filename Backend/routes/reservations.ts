import { Router, Request, Response } from "express";
import { createSupabaseWithAccessToken } from "../config/supabase";
import { getResourceById } from "../db/resources";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { insertReservation } from "../services/reservationService";
import { buildReservationVoiceScript, generateVoiceMessage } from "../services/voiceCallService";

const router = Router();

router.post("/", requireAuth, requireRole(["seeker"]), async (req: Request, res: Response) => {
  try {
    const token = req.authToken;
    if (!token || !req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { resource_id, phone_number, customer_name } = req.body ?? {};
    if (typeof resource_id !== "string" || !resource_id.trim()) {
      return res.status(400).json({ error: "resource_id is required" });
    }

    const phone =
      typeof phone_number === "string" && phone_number.trim() ? phone_number.trim() : null;
    if (!phone) {
      return res.status(400).json({ error: "phone_number is required" });
    }

    const resource = await getResourceById(resource_id.trim());
    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    const db = createSupabaseWithAccessToken(token);
    const reservation = await insertReservation(db, {
      user_id: req.user.id,
      resource_id: resource.id,
      phone_number: phone,
      customer_name: typeof customer_name === "string" ? customer_name : undefined,
    });

    const script = buildReservationVoiceScript(resource.title, resource.expires_at);
    const tts = await generateVoiceMessage(script);

    return res.status(201).json({
      success: true,
      reservation,
      voice: tts ? { audioBase64: tts.audioBase64 } : {},
    });
  } catch (err) {
    console.error("[POST /api/reservations] failed:", err);
    const message = err instanceof Error ? err.message : "Reservation failed";
    return res.status(500).json({ error: message });
  }
});

export default router;
