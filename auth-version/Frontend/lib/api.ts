const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
export const API_BASE = (raw ? raw.replace(/\/$/, "") : "") || "http://localhost:5001";

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

export function authHeaders(accessToken: string | null | undefined): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}
