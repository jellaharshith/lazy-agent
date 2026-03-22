import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * Browser Supabase client (lazy). Safe for Next.js SSG: nothing throws until first use on the client.
 */
export function getSupabase(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to Frontend .env.local (same values as SUPABASE_URL / SUPABASE_ANON_KEY)."
    );
  }

  browserClient = createClient(url, key);
  return browserClient;
}
