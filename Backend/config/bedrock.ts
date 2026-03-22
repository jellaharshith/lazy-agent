import dotenv from "dotenv";
import path from "path";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

/** Region for Bedrock (SDK + test route). Prefer AWS_REGION in .env (e.g. us-east-1). */
export const BEDROCK_REGION =
  process.env.AWS_REGION?.trim() || "us-east-1";

/** Model ID for GET /api/ai/bedrock-test (override with BEDROCK_MODEL_ID). */
export const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID?.trim() ||
  "anthropic.claude-3-haiku-20240307-v1:0";

export const bedrockRuntimeClient = new BedrockRuntimeClient({
  region: BEDROCK_REGION,
});

/**
 * Inference profile or model ID (e.g. anthropic.claude-3-haiku-20240307-v1:0).
 * Override in .env if your account uses a different ID.
 */
export const BEDROCK_CLASSIFY_MODEL_ID =
  process.env.BEDROCK_CLASSIFY_MODEL_ID?.trim() ||
  "anthropic.claude-3-haiku-20240307-v1:0";

/**
 * Opt-in for hackathon demos on Elastic Beanstalk / IAM roles (no static keys).
 * If unset, Bedrock runs only when AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY are set.
 */
function bedrockExplicitlyDisabled(): boolean {
  const v = process.env.BEDROCK_ENABLED?.trim().toLowerCase();
  return v === "0" || v === "false" || v === "no" || v === "off";
}

function bedrockExplicitlyEnabled(): boolean {
  const v = process.env.BEDROCK_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function hasStaticAwsCredentials(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID?.trim() && process.env.AWS_SECRET_ACCESS_KEY?.trim()
  );
}

/** Optional — OpenAI remains primary; Bedrock is fallback / comparison only. */
export function isBedrockConfigured(): boolean {
  if (bedrockExplicitlyDisabled()) return false;
  if (bedrockExplicitlyEnabled()) return true;
  return hasStaticAwsCredentials();
}
