import { Router, Request, Response } from "express";
import { listResourcesForProvider } from "../services/resourceService";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

router.get("/", requireAuth, requireRole(["provider"]), async (req: Request, res: Response) => {
  try {
    const providerId = req.user?.id;
    if (!providerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const rows = await listResourcesForProvider(providerId);
    return res.status(200).json(rows);
  } catch (err) {
    console.error("[GET /api/my/resources] failed:", err);
    const message = err instanceof Error ? err.message : "Failed to load provider resources";
    return res.status(500).json({ error: message });
  }
});

export default router;
