import { Router, Request, Response } from "express";
import { getLiveDashboardPayload } from "../services/dashboardLiveService";

const router = Router();

router.get("/live", async (_req: Request, res: Response) => {
  try {
    const payload = await getLiveDashboardPayload();
    return res.status(200).json(payload);
  } catch (err) {
    console.error("[GET /api/dashboard/live] failed:", err);
    const message = err instanceof Error ? err.message : "Failed to load dashboard";
    return res.status(500).json({ error: message });
  }
});

export default router;
