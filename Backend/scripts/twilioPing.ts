/**
 * Read-only Twilio check: GET /Accounts/{AccountSid}/Calls.json?PageSize=1
 * (Works with restricted API keys; full Auth Token can use Account.json too.)
 * Run: npm run twilio:ping
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

import { getTwilioConfig, twilioBasicAuthUser } from "../config/twilio";

async function main() {
  const cfg = getTwilioConfig();
  if (!cfg) {
    console.error("Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER in .env");
    process.exit(1);
  }

  const user = twilioBasicAuthUser(cfg);
  console.log(
    "Auth mode:",
    cfg.apiKeySid ? "API Key (SK… + secret) — TWILIO_API_KEY_SID is set" : "Account (AC… + main Auth Token)"
  );
  const auth = Buffer.from(`${user}:${cfg.authToken}`).toString("base64");
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Calls.json?PageSize=1`;

  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  const text = await res.text();
  if (!res.ok) {
    console.error("FAIL HTTP", res.status, text.slice(0, 400));
    if (res.status === 401 && !cfg.apiKeySid) {
      console.error(
        "\nHint: If you created an API Key (SK…) + secret, set TWILIO_API_KEY_SID=SK… and TWILIO_AUTH_TOKEN=<that key’s secret>."
      );
    }
    if (res.status === 401 && text.includes("70051")) {
      console.error(
        "\nHint: This API key may lack Call permissions. Use a Standard key with Call access, or use the main Account Auth Token (unset TWILIO_API_KEY_SID)."
      );
    }
    process.exit(1);
  }

  const j = JSON.parse(text) as { calls?: unknown[] };
  console.log("OK — Twilio accepted these credentials (Calls API reachable).");
  console.log("Auth user:", user.startsWith("SK") ? "API Key SID" : "Account SID");
  console.log("Recent calls sample:", Array.isArray(j.calls) ? `${j.calls.length} row(s) in page` : "n/a");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
