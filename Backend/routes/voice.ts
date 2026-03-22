import { Router, Request, Response } from "express";
import { isDemoMode } from "../config/twilio";
import { requireAuth } from "../middleware/auth";
import { placeTwilioSayCall } from "../services/voiceCallService";

const router = Router();

function maskE164(to: string): string {
  const d = to.replace(/\D/g, "");
  if (d.length < 4) return "••••";
  return `••••${d.slice(-4)}`;
}

/**
 * POST /api/voice/test-call
 * Rings TWILIO_TEST_TO (server .env) — same script as `npm run twilio:test-call`.
 * Auth: Supabase Bearer token. Trial Twilio: destination must be verified.
 */
router.post("/test-call", requireAuth, async (_req: Request, res: Response) => {
  try {
    if (isDemoMode()) {
      return res.status(400).json({
        success: false,
        error: "DEMO_MODE is enabled; no real call is placed. Set DEMO_MODE=false in .env.",
      });
    }

    const to = process.env.TWILIO_TEST_TO?.trim();
    if (!to) {
      return res.status(503).json({
        success: false,
        error:
          "TWILIO_TEST_TO is not set on the server. Add it to .env (E.164) or run: npm run twilio:test-call",
      });
    }

    const spoken =
      "This is a test call from Surplus Link. If you hear this, Twilio outbound is working. Goodbye.";
    const r = await placeTwilioSayCall(to, spoken);
    if (!r.ok) {
      return res.status(502).json({ success: false, error: r.detail });
    }

    return res.status(200).json({
      success: true,
      message: r.detail,
      destinationHint: maskE164(to),
    });
  } catch (err) {
    console.error("[POST /api/voice/test-call]", err);
    const message = err instanceof Error ? err.message : "Test call failed";
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
