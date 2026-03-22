import type { NextFunction, Request, Response } from "express";
import { supabase } from "../config/supabase";

/**
 * Verifies `Authorization: Bearer <access_token>` using Supabase Auth.
 * On success, sets `req.user` and `req.authToken`.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.user = data.user;
  req.authToken = token;
  next();
}

/**
 * If `Authorization: Bearer` is present and valid, sets `req.user` / `req.authToken`.
 * If missing or invalid, continues without `req.user` (unauthenticated intake still works).
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    next();
    return;
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) {
      req.user = data.user;
      req.authToken = token;
    }
  } catch {
    /* proceed without user */
  }
  next();
}
