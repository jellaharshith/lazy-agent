import { getElevenLabsConfig } from "../config/elevenlabs";
import {
  getTwilioConfig,
  isDemoMode,
  requireTwilioConfig,
  twilioBasicAuthUser,
} from "../config/twilio";

/** Default voice (Rachel) — override with ELEVENLABS_VOICE_ID. */
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

export type ReservationVoiceCallInput = {
  toNumber: string;
  customerName?: string;
  providerName?: string;
  resourceTitle: string;
  discountedPrice?: number;
  pickupTime?: string;
  reservationId: string;
};

export type VoiceCallResult = {
  attempted: boolean;
  success: boolean;
  provider: "twilio-elevenlabs" | "demo";
  message: string;
  simulated?: boolean;
};

function logDemoPayload(label: string, input: ReservationVoiceCallInput, spoken: string): void {
  console.log(`[voiceCall] DEMO_MODE ${label}`, {
    to: input.toNumber,
    reservationId: input.reservationId,
    spokenPreview: spoken.slice(0, 200) + (spoken.length > 200 ? "…" : ""),
  });
}

function formatPrice(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return ` The discounted price is ${n.toFixed(2)} dollars.`;
}

function buildSeekerSpokenMessage(input: ReservationVoiceCallInput): string {
  const title = input.resourceTitle.trim() || "your pickup";
  const greet =
    input.customerName && input.customerName.trim()
      ? `Hello, ${input.customerName.trim()}. `
      : "Hello. ";
  const pickup =
    input.pickupTime && input.pickupTime.trim()
      ? ` Please pick up before ${input.pickupTime.trim()}.`
      : "";
  const price = formatPrice(input.discountedPrice);
  return `${greet}This is Surplus Link. Your reservation for ${title} is confirmed.${price}${pickup} Your reservation reference is ${input.reservationId.slice(0, 8)}. Thank you.`;
}

function buildProviderSpokenMessage(input: ReservationVoiceCallInput): string {
  const title = input.resourceTitle.trim() || "a listing";
  const greet =
    input.providerName && input.providerName.trim()
      ? `Hello, ${input.providerName.trim()}. `
      : "Hello. ";
  const who =
    input.customerName && input.customerName.trim()
      ? `${input.customerName.trim()} has `
      : "A customer has ";
  const price = formatPrice(input.discountedPrice);
  return `${greet}This is Surplus Link with a reservation alert. ${who}reserved ${title}.${price} Reservation reference ${input.reservationId.slice(0, 8)}. Please prepare this pickup. Thank you.`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Twilio `<Say>` path works without hosting audio. Later: swap TwiML to `<Play>`
 * with an ElevenLabs-generated URL for the same script.
 */
function twimlSayAlice(message: string): string {
  const safe = escapeXml(message);
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">${safe}</Say></Response>`;
}

/** Compare caller ID vs destination — Twilio rejects (or never rings) when From and To are the same. */
function phoneDigitsComparable(s: string): string {
  const d = s.replace(/\D/g, "");
  if (d.length === 10) return `1${d}`;
  if (d.length === 11 && d.startsWith("1")) return d;
  return d;
}

async function twilioPlaceCall(to: string, spokenMessage: string): Promise<{ ok: boolean; detail: string }> {
  let cfg: ReturnType<typeof requireTwilioConfig>;
  try {
    cfg = requireTwilioConfig();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: msg };
  }

  const fromKey = phoneDigitsComparable(cfg.phoneNumber);
  const toKey = phoneDigitsComparable(to);
  if (fromKey && toKey && fromKey === toKey) {
    return {
      ok: false,
      detail:
        "From and To cannot be the same number. TWILIO_PHONE_NUMBER is your Twilio caller ID — use a different personal phone for the seeker (Reserve) field and for TWILIO_TEST_TO.",
    };
  }

  const twiml = twimlSayAlice(spokenMessage);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Calls.json`;
  const body = new URLSearchParams({
    To: to,
    From: cfg.phoneNumber,
    Twiml: twiml,
  });
  const user = twilioBasicAuthUser(cfg);
  const auth = Buffer.from(`${user}:${cfg.authToken}`).toString("base64");

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 45_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: ac.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false, detail: `Twilio HTTP ${res.status}: ${errText.slice(0, 300)}` };
    }
    return { ok: true, detail: "Outbound call created" };
  } catch (err) {
    clearTimeout(t);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, detail: msg };
  }
}

/** One-off outbound test / scripts — same TwiML path as reservations. */
export async function placeTwilioSayCall(
  to: string,
  spokenMessage: string
): Promise<{ ok: boolean; detail: string }> {
  return twilioPlaceCall(to, spokenMessage);
}

async function runOutboundVoiceCall(
  label: "seeker" | "provider",
  input: ReservationVoiceCallInput,
  buildSpoken: (i: ReservationVoiceCallInput) => string
): Promise<VoiceCallResult> {
  const to = typeof input.toNumber === "string" ? input.toNumber.trim() : "";
  if (!to) {
    return {
      attempted: false,
      success: false,
      provider: "twilio-elevenlabs",
      message: `Skipped ${label} call: no phone number`,
    };
  }

  const spoken = buildSpoken(input);

  if (isDemoMode()) {
    logDemoPayload(label, input, spoken);
    return {
      attempted: true,
      success: true,
      provider: "demo",
      simulated: true,
      message: "Simulated voice confirmation call",
    };
  }

  if (!getTwilioConfig()) {
    return {
      attempted: true,
      success: false,
      provider: "twilio-elevenlabs",
      message:
        "Twilio credentials missing; set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER or enable DEMO_MODE=true",
    };
  }

  const { ok, detail } = await twilioPlaceCall(to, spoken);
  if (ok) {
    return {
      attempted: true,
      success: true,
      provider: "twilio-elevenlabs",
      message: "Voice call placed via Twilio (Say). ElevenLabs Play URL can replace TwiML later.",
    };
  }
  console.error(`[voiceCall] ${label} Twilio failed:`, detail);
  return {
    attempted: true,
    success: false,
    provider: "twilio-elevenlabs",
    message: detail,
  };
}

export async function sendSeekerReservationCall(input: ReservationVoiceCallInput): Promise<VoiceCallResult> {
  return runOutboundVoiceCall("seeker", input, buildSeekerSpokenMessage);
}

export async function sendProviderReservationAlertCall(
  input: ReservationVoiceCallInput
): Promise<VoiceCallResult> {
  return runOutboundVoiceCall("provider", input, buildProviderSpokenMessage);
}

/** @deprecated Prefer {@link sendSeekerReservationCall} for the reservation flow. Kept for scripts or UI TTS. */
export function buildReservationVoiceScript(resourceTitle: string, expiresAt: string | null): string {
  const title = resourceTitle.trim() || "your pickup";
  let deadline = "the time shown in the app";
  if (expiresAt) {
    const d = new Date(expiresAt);
    if (!Number.isNaN(d.getTime())) {
      deadline = d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    }
  }
  return `Your reservation for ${title} has been confirmed. Please pick it up before ${deadline}.`;
}

/**
 * ElevenLabs text-to-speech (MP3). Never throws — returns null on missing config or API failure.
 */
export async function generateVoiceMessage(text: string): Promise<{ audioBase64: string } | null> {
  const { apiKey } = getElevenLabsConfig();
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!apiKey || !trimmed) {
    return null;
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_turbo_v2_5";

  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 60_000);
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: trimmed,
        model_id: modelId,
      }),
      signal: ac.signal,
    });
    clearTimeout(t);

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[voiceCall] TTS HTTP", res.status, errBody.slice(0, 400));
      return null;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) {
      console.error("[voiceCall] TTS empty body");
      return null;
    }

    return { audioBase64: buf.toString("base64") };
  } catch (err) {
    console.error("[voiceCall] generateVoiceMessage failed:", err);
    return null;
  }
}
