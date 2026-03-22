import dns from "node:dns";

/**
 * Supabase `db.*.supabase.co` is often IPv6-only; default `pg` DNS can yield ENOTFOUND.
 */
export async function resolveSupabaseDbHostname(
  hostname: string,
  logLabel: string
): Promise<string> {
  try {
    const v6 = await dns.promises.resolve6(hostname);
    if (v6.length > 0) {
      console.log(`[${logLabel}] Resolved db host to IPv6 (Node DNS workaround).`);
      return v6[0]!;
    }
  } catch {
    /* try A */
  }
  try {
    const v4 = await dns.promises.resolve4(hostname);
    if (v4.length > 0) return v4[0]!;
  } catch {
    /* hostname as-is */
  }
  return hostname;
}
