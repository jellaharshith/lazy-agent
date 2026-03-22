import type { User } from "@supabase/supabase-js";

declare global {
  namespace Express {
    interface Request {
      /** Set by `requireAuth` after a valid Supabase JWT. */
      user?: User;
      /** Raw Bearer token (for RLS-scoped Supabase calls). */
      authToken?: string;
      /** Set by `requireRole` after profile is loaded. */
      profile?: { role: string };
    }
  }
}

export {};
