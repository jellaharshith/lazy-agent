import { createClient, SupabaseClient } from "@supabase/supabase-js";

function requireEnv(name: "SUPABASE_URL" | "SUPABASE_ANON_KEY"): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `Missing required environment variable: ${name}. Set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file.`
    );
  }
  return value.trim();
}

const supabaseUrl = requireEnv("SUPABASE_URL");
const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

let adminClient: SupabaseClient | null | undefined;

/** Service-role client for server-only aggregates (e.g. dashboard). Optional — omit key to skip. */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (adminClient !== undefined) return adminClient;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    adminClient = null;
    return null;
  }
  adminClient = createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

/** RLS-aware client: use the end-user JWT so `profiles` and other policies apply. */
export function createSupabaseWithAccessToken(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
