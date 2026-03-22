/**
 * ElevenLabs / voice outbound configuration.
 * Real phone integrations vary by product; keep keys in env only.
 */
export function getElevenLabsConfig(): {
  apiKey: string | null;
  demoMode: boolean;
} {
  const demoMode = String(process.env.DEMO_MODE ?? "").toLowerCase() === "true";
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim() || null;
  return { apiKey, demoMode };
}
