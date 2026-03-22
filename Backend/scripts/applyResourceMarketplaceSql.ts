/**
 * Applies Backend/sql/add_resource_marketplace_fields.sql via Postgres.
 *
 * Set DATABASE_URL or SUPABASE_URL + SUPABASE_DB_PASSWORD (see applyProfilePhoneSql).
 *
 * If you see getaddrinfo ENOTFOUND for db.<ref>.supabase.co, that host can be IPv6-only
 * while Node prefers IPv4 — we set dns order to "verbatim" below. If it still fails, use
 * the Session pooler string from Supabase → Settings → Database:
 *   DATABASE_URL=postgresql://postgres.<ref>:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
 * (URL-encode special characters in PASSWORD, e.g. @ → %40)
 * Or set SUPABASE_DB_HOST + SUPABASE_DB_USER (postgres.<ref>) + SUPABASE_DB_PASSWORD.
 *
 * Run: npm run db:apply-resource-marketplace
 */
import dns from "node:dns";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
import { Client } from "pg";
import { resolveSupabaseDbHostname } from "./lib/resolveSupabasePgHost";

dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });
/** Lets Node resolve IPv6-only Supabase direct DB hostnames (fixes ENOTFOUND on many Macs). */
dns.setDefaultResultOrder("verbatim");

function projectRefFromUrl(urlStr: string): string | null {
  try {
    const u = new URL(urlStr);
    const host = u.hostname;
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return m ? m[1]! : null;
  } catch {
    return null;
  }
}

/** Supavisor hosts vary by project (`aws-1-us-east-1` vs `aws-0-us-west-1`). */
const POOLER_PREFIXES = ["aws-1", "aws-0"] as const;

const DEFAULT_POOLER_REGIONS = [
  "us-east-1",
  "us-west-1",
  "us-east-2",
  "us-west-2",
  "eu-west-1",
  "eu-central-1",
  "ap-southeast-1",
] as const;

function shouldTryPoolerFallback(err: unknown): boolean {
  const e = err as NodeJS.ErrnoException;
  const code = e?.code;
  return (
    code === "EHOSTUNREACH" ||
    code === "ENETUNREACH" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT"
  );
}

function statementsFromFile(raw: string): string[] {
  const noLineComments = raw
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
  return noLineComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function openConnectedClient(config: ConstructorParameters<typeof Client>[0]): Promise<Client> {
  const c = new Client(config);
  await c.connect();
  return c;
}

async function connectWithoutDatabaseUrl(): Promise<Client> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (!supabaseUrl || !password) {
    console.error(
      "Missing database credentials. Add to .env either:\n" +
        "  DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@db.<ref>.supabase.co:5432/postgres\n" +
        "or:\n" +
        "  SUPABASE_URL=https://<ref>.supabase.co\n" +
        "  SUPABASE_DB_PASSWORD=<Supabase → Settings → Database → Database password>\n"
    );
    process.exit(1);
  }
  const ref = projectRefFromUrl(supabaseUrl);
  if (!ref) {
    console.error("Could not parse project ref from SUPABASE_URL");
    process.exit(1);
  }
  const customHost = process.env.SUPABASE_DB_HOST?.trim();
  const customUser = process.env.SUPABASE_DB_USER?.trim();
  const customPortRaw = process.env.SUPABASE_DB_PORT?.trim();
  const customPort =
    customPortRaw && Number.isFinite(Number(customPortRaw)) ? Number(customPortRaw) : 5432;
  const logicalHost = customHost || `db.${ref}.supabase.co`;
  const host = customHost
    ? logicalHost
    : await resolveSupabaseDbHostname(logicalHost, "applyResourceMarketplace");

  const ssl = { rejectUnauthorized: false };

  try {
    return await openConnectedClient({
      host,
      port: customPort,
      user: customUser || "postgres",
      password,
      database: "postgres",
      ssl,
    });
  } catch (directErr) {
    if (!customHost && shouldTryPoolerFallback(directErr)) {
      const extra = process.env.SUPABASE_POOLER_REGION?.trim();
      const regions = [...new Set([extra, ...DEFAULT_POOLER_REGIONS].filter(Boolean))] as string[];
      let last: unknown = directErr;
      for (const prefix of POOLER_PREFIXES) {
        for (const region of regions) {
          const poolerHost = `${prefix}-${region}.pooler.supabase.com`;
          try {
            console.log(
              `[applyResourceMarketplace] Direct DB unreachable; trying Session pooler ${poolerHost}…`
            );
            return await openConnectedClient({
              host: poolerHost,
              port: 5432,
              user: `postgres.${ref}`,
              password,
              database: "postgres",
              ssl,
            });
          } catch (e) {
            last = e;
          }
        }
      }
      throw last;
    }
    throw directErr;
  }
}

async function main() {
  const connStr = process.env.DATABASE_URL?.trim() || process.env.SUPABASE_DATABASE_URL?.trim();

  const sqlPath = path.resolve(__dirname, "..", "sql", "add_resource_marketplace_fields.sql");
  const raw = fs.readFileSync(sqlPath, "utf8");
  const stmts = statementsFromFile(raw);
  if (stmts.length === 0) {
    console.error("No SQL statements found");
    process.exit(1);
  }

  const client = connStr
    ? await openConnectedClient({
        connectionString: connStr,
        ssl: connStr.includes("localhost") ? undefined : { rejectUnauthorized: false },
      })
    : await connectWithoutDatabaseUrl();

  try {
    for (const st of stmts) {
      await client.query(st);
    }
    console.log("OK: resources marketplace columns ensured (IF NOT EXISTS).");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
