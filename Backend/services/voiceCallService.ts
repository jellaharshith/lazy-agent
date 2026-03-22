import { getElevenLabsConfig } from "../config/elevenlabs";

/** Default voice (Rachel) — override with ELEVENLABS_VOICE_ID. */
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

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
