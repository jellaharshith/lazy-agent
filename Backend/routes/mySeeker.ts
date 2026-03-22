import { Router, Request, Response } from "express";
import { createSupabaseWithAccessToken } from "../config/supabase";
import { getResourceById } from "../db/resources";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

router.get("/reservations", requireAuth, requireRole(["seeker"]), async (req: Request, res: Response) => {
  try {
    const token = req.authToken;
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = createSupabaseWithAccessToken(token);
    const { data, error } = await db
      .from("reservations")
      .select("id, resource_id, status, phone_number, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const rows = data ?? [];
    const enriched = await Promise.all(
      rows.map(async (r: { id: string; resource_id: string; status: string; phone_number: string | null; created_at: string }) => {
        let title: string | null = null;
        try {
          const resource = await getResourceById(r.resource_id);
          title = resource?.title ?? null;
        } catch {
          title = null;
        }
        return { ...r, resource_title: title };
      })
    );

    return res.status(200).json(enriched);
  } catch (err) {
    console.error("[GET /api/my/reservations]", err);
    const message = err instanceof Error ? err.message : "Failed to load reservations";
    return res.status(500).json({ error: message });
  }
});

export default router;
