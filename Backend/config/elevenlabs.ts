/**
 * ElevenLabs — keys in env only. Use {@link requireElevenLabsApiKey} only when calling the API.
 */
export function getElevenLabsConfig(): { apiKey: string | null } {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim() || null;
  return { apiKey };
}

export function requireElevenLabsApiKey(): string {
  const { apiKey } = getElevenLabsConfig();
  if (!apiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY is missing. Set it in your environment when using ElevenLabs TTS or voice features."
    );
  }
  return apiKey;
}
