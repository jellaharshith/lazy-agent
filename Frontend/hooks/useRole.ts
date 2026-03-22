"use client";

import { useAuth } from "@/context/AuthContext";

/**
 * Role helpers for seeker vs provider flows (profile row, then signup metadata).
 */
export function useRole() {
  const { profile, session } = useAuth();

  const meta = session?.user?.user_metadata as { role?: string } | undefined;
  const metaRole = meta?.role === "provider" || meta?.role === "seeker" ? meta.role : null;

  const role = profile?.role ?? metaRole;
  const isSeeker = role === "seeker";
  const isProvider = role === "provider";

  return { role, isSeeker, isProvider };
}
