import type { NextFunction, Request, Response } from "express";
import { createSupabaseWithAccessToken } from "../config/supabase";

export type AppRole = "seeker" | "provider";

/**
 * Use after `requireAuth`. Loads `profiles.role` with the caller's JWT (RLS).
 *
 * @example
 * app.get("/api/provider/thing", requireAuth, requireRole(["provider"]), handler);
 */
export function requireRole(allowedRoles: AppRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }

    const db = createSupabaseWithAccessToken(token);
    const { data: profile, error } = await db
      .from("profiles")
      .select("id, role")
      .eq("id", req.user.id)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: "Failed to load profile" });
      return;
    }

    if (!profile?.role) {
      res.status(403).json({ error: "Profile not found" });
      return;
    }

    const role = profile.role as AppRole;
    if (!allowedRoles.includes(role)) {
      res.status(403).json({
        error: "Forbidden",
        message: `Requires one of: ${allowedRoles.join(", ")}`,
      });
      return;
    }

    req.profile = { role: profile.role };
    next();
  };
}
