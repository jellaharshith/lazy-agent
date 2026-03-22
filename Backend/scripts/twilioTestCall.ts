/**
 * Place one real test call (Twilio `<Say>`). Trial accounts: verify the number in Twilio first.
 * Usage: TWILIO_TEST_TO=+15551234567 npm run twilio:test-call
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

import { isDemoMode } from "../config/twilio";
import { placeTwilioSayCall } from "../services/voiceCallService";

async function main() {
  const to = process.env.TWILIO_TEST_TO?.trim();
  if (!to) {
    console.error("Set TWILIO_TEST_TO in .env to your E.164 cell (e.g. +15551234567), or run:");
    console.error("  TWILIO_TEST_TO=+15551234567 npm run twilio:test-call");
    console.error("Trial Twilio: verify that number under Phone Numbers → Verified Caller IDs.");
    process.exit(1);
  }

  if (isDemoMode()) {
    console.error("DEMO_MODE is true — no real call. Set DEMO_MODE=false in .env.");
    process.exit(1);
  }

  const msg =
    "This is a test call from Surplus Link. If you hear this, Twilio outbound is working. Goodbye.";
  console.log("Calling", to, "…");
  const r = await placeTwilioSayCall(to, msg);
  if (!r.ok) {
    console.error("FAIL:", r.detail);
    process.exit(1);
  }
  console.log("OK:", r.detail);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
