import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";

/**
 * Example routes for testing JWT + role middleware.
 * Mounted at `/api/protected` — see Backend/index.ts.
 */
const router = Router();

router.get("/me", requireAuth, (req, res) => {
  res.status(200).json({
    user: {
      id: req.user!.id,
      email: req.user!.email,
    },
  });
});

router.get("/provider-only", requireAuth, requireRole(["provider"]), (req, res) => {
  res.status(200).json({
    ok: true,
    scope: "provider",
    profileRole: req.profile?.role,
  });
});

router.get("/seeker-only", requireAuth, requireRole(["seeker"]), (req, res) => {
  res.status(200).json({
    ok: true,
    scope: "seeker",
    profileRole: req.profile?.role,
  });
});

export default router;
