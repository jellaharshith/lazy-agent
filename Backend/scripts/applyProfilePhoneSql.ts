/**
 * Applies Backend/sql/add_profile_phone.sql using a direct Postgres connection.
 *
 * Set one of:
 *   DATABASE_URL=postgresql://postgres:PASSWORD@db.<ref>.supabase.co:5432/postgres
 *   SUPABASE_DB_PASSWORD=<Database password from Supabase → Settings → Database>
 *
 * Run: npm run db:apply-profile-phone
 */
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

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

async function main() {
  const connStr = process.env.DATABASE_URL?.trim() || process.env.SUPABASE_DATABASE_URL?.trim();
  let client: Client;

  if (connStr) {
    client = new Client({
      connectionString: connStr,
      ssl: connStr.includes("localhost") ? undefined : { rejectUnauthorized: false },
    });
  } else {
    const supabaseUrl = process.env.SUPABASE_URL?.trim();
    const password = process.env.SUPABASE_DB_PASSWORD?.trim();
    if (!supabaseUrl || !password) {
      console.error(
        "Missing database credentials. Add to .env either:\n" +
          "  DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@db.<ref>.supabase.co:5432/postgres\n" +
          "or:\n" +
          "  SUPABASE_URL=https://<ref>.supabase.co\n" +
          "  SUPABASE_DB_PASSWORD=<from Supabase Dashboard → Settings → Database → Database password>\n"
      );
      process.exit(1);
    }
    const ref = projectRefFromUrl(supabaseUrl);
    if (!ref) {
      console.error("Could not parse project ref from SUPABASE_URL");
      process.exit(1);
    }
    client = new Client({
      host: `db.${ref}.supabase.co`,
      port: 5432,
      user: "postgres",
      password,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
    });
  }

  const sqlPath = path.resolve(__dirname, "..", "sql", "add_profile_phone.sql");
  const raw = fs.readFileSync(sqlPath, "utf8");
  const sql = raw
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n")
    .trim();

  if (!sql) {
    console.error("No SQL after stripping comments");
    process.exit(1);
  }

  await client.connect();
  try {
    await client.query(sql);
    console.log("OK: profiles.phone_number column ensured (IF NOT EXISTS).");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
