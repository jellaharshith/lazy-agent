#!/usr/bin/env node
/**
 * Creates two dev users (seeker + provider) in Supabase Auth and `profiles`.
 *
 * Requires in repo root .env:
 *   SUPABASE_URL=https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=...   (Dashboard → Settings → API → service_role — never commit)
 *
 * Usage (repo root): node scripts/create-test-users.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFromFile() {
  const p = join(__dirname, "..", ".env");
  if (!existsSync(p)) return;
  const raw = readFileSync(p, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFromFile();

const url = process.env.SUPABASE_URL?.trim();
/** Prefer explicit name; some setups mistakenly put the service_role JWT in SUPABASE_ACCESS_TOKEN. */
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE?.trim() ||
  process.env.SUPABASE_ACCESS_TOKEN?.trim();

const DEFAULT_PASSWORD = process.env.DEV_TEST_USER_PASSWORD?.trim() || "LazyAgentTest1!";

const USERS = [
  {
    email: "seeker-dev@example.com",
    full_name: "Test Seeker",
    role: "seeker",
  },
  {
    email: "provider-dev@example.com",
    full_name: "Test Provider",
    role: "provider",
  },
];

if (!url || !serviceKey) {
  console.error(
    "Missing SUPABASE_URL or a service-role secret in .env (repo root).\n" +
      "Set SUPABASE_SERVICE_ROLE_KEY (Dashboard → Settings → API → service_role).\n" +
      "Never commit that key or expose it in the frontend."
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureUser({ email, full_name, role }, emailToUser) {
  const key = email.toLowerCase();
  const found = emailToUser.get(key);

  let userId;
  if (found) {
    userId = found.id;
    console.log(`Exists (auth): ${email}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name, role },
    });
    if (error) {
      console.error(`Create failed ${email}:`, error.message);
      return;
    }
    userId = data.user.id;
    emailToUser.set(key, data.user);
    console.log(`Created (auth): ${email}`);
  }

  const { error: pErr } = await supabase.from("profiles").upsert(
    { id: userId, full_name, role },
    { onConflict: "id" }
  );
  if (pErr) {
    console.error(`profiles upsert ${email}:`, pErr.message);
    return;
  }
  console.log(`OK (profiles): ${email} → ${role}`);
}

async function main() {
  console.log("Creating / updating dev test users…\n");

  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) {
    console.error("Could not list users:", listErr.message);
    process.exit(1);
  }
  const emailToUser = new Map(
    (listData?.users ?? []).map((u) => [u.email?.toLowerCase() ?? "", u])
  );

  for (const u of USERS) {
    await ensureUser(u, emailToUser);
  }
  console.log("\nDone. Sign in at /signin with:");
  console.log(`  Password (both): ${DEFAULT_PASSWORD}`);
  for (const u of USERS) {
    console.log(`  ${u.role}: ${u.email}`);
  }
  console.log("\nOverride password: set DEV_TEST_USER_PASSWORD in .env before running.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
