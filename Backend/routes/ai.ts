import { Router, Request, Response } from "express";
import { classifyNeed, pingGemini } from "../services/aiService";

function isOkTrue(parsed: unknown): boolean {
  return (
    typeof parsed === "object" &&
    parsed !== null &&
    !Array.isArray(parsed) &&
    (parsed as Record<string, unknown>).ok === true
  );
}

async function routerPingHandler(_req: Request, res: Response): Promise<void> {
  try {
    const gemini = await pingGemini();
    const ok = gemini.parseError === null && isOkTrue(gemini.parsed);
    const errorMsg =
      gemini.parseError ??
      (ok
        ? null
        : `Expected JSON with "ok": true, got: ${JSON.stringify(gemini.parsed)}`);

    res.status(200).json({
      success: ok,
      provider: "gemini" as const,
      raw: gemini.raw,
      parsed: gemini.parsed,
      error: ok ? null : errorMsg,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ai] GET /ping: Gemini failed:", msg);
    res.status(200).json({
      success: false,
      provider: "gemini" as const,
      raw: "",
      parsed: null,
      error: msg,
    });
  }
}

const router = Router();

router.get("/ping", routerPingHandler);

router.get("/", (_req: Request, res: Response) => {
  try {
    res.status(200).json({
      message: "AI API",
      usage: {
        classify: "POST /api/ai/classify — body: { raw_text: string }",
        ping: "GET /api/ai/ping — debug Gemini connectivity",
      },
    });
  } catch (err) {
    console.error("GET /api/ai", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.post("/classify", async (req: Request, res: Response) => {
  console.log("POST /api/ai/classify incoming body:", req.body);

  try {
    const { raw_text } = req.body ?? {};

    if (typeof raw_text !== "string" || !raw_text.trim()) {
      res.status(400).json({ error: "raw_text is required" });
      return;
    }

    const text = raw_text.trim();
    const classification = await classifyNeed(text);

    res.status(200).json({
      raw_text: text,
      classification,
    });
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    console.error("POST /api/ai/classify full caught error:", err);
    console.error("POST /api/ai/classify caught message:", details);
    if (err instanceof Error && err.stack) {
      console.error("POST /api/ai/classify stack:", err.stack);
    }
    res.status(500).json({
      error: "Classification failed",
      details,
    });
  }
});

export default router;
