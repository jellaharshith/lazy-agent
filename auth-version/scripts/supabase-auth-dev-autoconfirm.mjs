#!/usr/bin/env node
/**
 * Enables mailer_autoconfirm on your Supabase project so signups are confirmed
 * without sending confirmation emails (avoids built-in email rate limits while testing).
 *
 * Requires SUPABASE_ACCESS_TOKEN in .env — create at:
 * https://supabase.com/dashboard/account/tokens
 *
 * Usage (from repo root): node scripts/supabase-auth-dev-autoconfirm.mjs
 */
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

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const url = process.env.SUPABASE_URL?.trim();
const ref =
  process.env.SUPABASE_PROJECT_REF?.trim() ||
  (url && /https:\/\/([^.]+)\.supabase\.co/.exec(url)?.[1]);

if (!token) {
  console.error(
    "Missing SUPABASE_ACCESS_TOKEN. Add it to your root .env file.\n" +
      "Create a token: https://supabase.com/dashboard/account/tokens"
  );
  process.exit(1);
}

if (!ref) {
  console.error(
    "Could not resolve project ref. Set SUPABASE_URL (…projectref….supabase.co) or SUPABASE_PROJECT_REF in .env."
  );
  process.exit(1);
}

const endpoint = `https://api.supabase.com/v1/projects/${ref}/config/auth`;

const res = await fetch(endpoint, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ mailer_autoconfirm: true }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`Request failed (${res.status}):`, text);
  process.exit(1);
}

console.log("Updated Supabase Auth: mailer_autoconfirm = true");
console.log("(Signups no longer require confirmation emails — good for local testing; re-enable in dashboard for production.)");
try {
  const j = JSON.parse(text);
  if (j.mailer_autoconfirm !== undefined) {
    console.log("Verified mailer_autoconfirm:", j.mailer_autoconfirm);
  }
} catch {
  console.log(text.slice(0, 500));
}
