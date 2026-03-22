import { Router, Request, Response } from "express";
import { getMatchesByNeedIds } from "../db/matches";
import { listNeedsByUserId } from "../db/needs";
import { listResourcesByProviderId } from "../db/resources";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

router.get("/matches", requireAuth, requireRole(["seeker"]), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const needs = await listNeedsByUserId(userId);
    const needIds = needs.map((n) => n.id);
    const matches = await getMatchesByNeedIds(needIds);

    const byNeed = new Map<string, typeof matches>();
    for (const m of matches) {
      const nid = m.need_id;
      if (!nid) continue;
      const list = byNeed.get(nid) ?? [];
      list.push(m);
      byNeed.set(nid, list);
    }

    const items = needs.map((need) => ({
      need,
      matches: byNeed.get(need.id) ?? [],
    }));

    res.status(200).json({ items });
  } catch (err) {
    console.error("[GET /api/my/matches]", err);
    const message = err instanceof Error ? err.message : "Failed to load matches";
    res.status(500).json({ error: message });
  }
});

router.get("/resources", requireAuth, requireRole(["provider"]), async (req: Request, res: Response) => {
  try {
    const resources = await listResourcesByProviderId(req.user!.id);
    res.status(200).json({ resources });
  } catch (err) {
    console.error("[GET /api/my/resources]", err);
    const message = err instanceof Error ? err.message : "Failed to load resources";
    res.status(500).json({ error: message });
  }
});

export default router;
