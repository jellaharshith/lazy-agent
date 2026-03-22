import { Router, Request, Response } from "express";
import { isBedrockUnavailable, testBedrock } from "../services/bedrockService";

const router = Router();

router.get("/bedrock-test", async (_req: Request, res: Response) => {
  try {
    const result = await testBedrock();
    if (isBedrockUnavailable(result)) {
      console.warn("Bedrock unavailable");
      res.status(200).json({
        success: false,
        provider: "bedrock" as const,
        error: "Model access not enabled",
      });
      return;
    }
    const { raw, parsed } = result;
    res.status(200).json({
      success: true,
      raw,
      parsed,
      provider: "bedrock" as const,
    });
  } catch (err) {
    console.warn("Bedrock unavailable");
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(msg);
    console.error("[bedrock-test] GET /api/ai/bedrock-test failed:", msg);
    res.status(200).json({
      success: false,
      provider: "bedrock" as const,
      error: "Model access not enabled",
    });
  }
});

export default router;
