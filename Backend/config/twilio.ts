/**
 * Twilio outbound call configuration (env only).
 * Validate with {@link requireTwilioConfig} only when placing a real call — not at app startup.
 */
export type TwilioConfig = {
  /** Account SID (AC…) — used in REST URLs. */
  accountSid: string;
  /**
   * Main **Auth Token**, OR the **API Key secret** when `apiKeySid` is set.
   * (Twilio Basic auth is either `AC:auth_token` or `SK:api_key_secret`.)
   */
  authToken: string;
  phoneNumber: string;
  /** If set (SK…), Basic auth uses `apiKeySid:authToken` instead of `accountSid:authToken`. */
  apiKeySid?: string;
};

export function getTwilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() || "";
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER?.trim() || "";
  const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim() || "";
  if (!accountSid || !authToken || !phoneNumber) {
    return null;
  }
  return {
    accountSid,
    authToken,
    phoneNumber,
    ...(apiKeySid ? { apiKeySid } : {}),
  };
}

export function requireTwilioConfig(): TwilioConfig {
  const c = getTwilioConfig();
  if (!c) {
    throw new Error(
      "Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN (main Auth Token or API Key secret), TWILIO_PHONE_NUMBER, and optionally TWILIO_API_KEY_SID (SK…) when using an API key."
    );
  }
  return c;
}

/** Username for HTTP Basic auth to api.twilio.com */
export function twilioBasicAuthUser(cfg: TwilioConfig): string {
  return cfg.apiKeySid?.trim() ? cfg.apiKeySid.trim() : cfg.accountSid;
}

export function isDemoMode(): boolean {
  return String(process.env.DEMO_MODE ?? "").toLowerCase() === "true";
}
