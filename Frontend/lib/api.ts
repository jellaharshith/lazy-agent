import type { Session } from "@supabase/supabase-js";

const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
export const API_BASE = (raw ? raw.replace(/\/$/, "") : "") || "http://localhost:5001";

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

export function jsonHeaders(session?: Session | null): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.access_token) {
    h.Authorization = `Bearer ${session.access_token}`;
  }
  return h;
}
