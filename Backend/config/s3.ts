import dotenv from "dotenv";
import path from "path";
import { S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";

dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

export const AWS_REGION =
  process.env.AWS_REGION?.trim() ||
  process.env.AWS_DEFAULT_REGION?.trim() ||
  "us-east-1";

/** Prefer `S3_BUCKET_NAME`; `S3_AUDIO_BUCKET` remains supported for older configs. */
export const S3_BUCKET_NAME =
  process.env.S3_BUCKET_NAME?.trim() || process.env.S3_AUDIO_BUCKET?.trim() || "";

/** @deprecated Use {@link S3_BUCKET_NAME} — same value, kept for existing imports. */
export const S3_AUDIO_BUCKET = S3_BUCKET_NAME;

/** Optional key prefix (no leading slash), e.g. `voice` or `prod/voice`. */
export const S3_AUDIO_PREFIX =
  process.env.S3_AUDIO_PREFIX?.trim().replace(/^\/+|\/+$/g, "") ?? "";

/**
 * Optional public or CDN base for browser/Twilio `<Play>` (no trailing slash).
 * If unset, storage service uses `s3://bucket/key`.
 */
export const S3_PUBLIC_BASE_URL =
  process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") ?? "";

function explicitCredentials():
  | { accessKeyId: string; secretAccessKey: string; sessionToken?: string }
  | undefined {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) return undefined;
  const sessionToken = process.env.AWS_SESSION_TOKEN?.trim();
  return {
    accessKeyId,
    secretAccessKey,
    ...(sessionToken ? { sessionToken } : {}),
  };
}

const s3Config: S3ClientConfig = { region: AWS_REGION };
const creds = explicitCredentials();
if (creds) s3Config.credentials = creds;

/**
 * Shared AWS SDK v3 client. Uses env static credentials when set; otherwise the SDK default chain (e.g. IAM role).
 */
export const s3Client = new S3Client(s3Config);

export function isS3Configured(): boolean {
  return S3_BUCKET_NAME.length > 0;
}

/** @deprecated Use {@link isS3Configured}. */
export function isS3AudioConfigured(): boolean {
  return isS3Configured();
}

/**
 * Returns the shared client when a bucket name is configured; otherwise `null` (callers skip uploads).
 * @deprecated Prefer importing {@link s3Client} and gating with {@link isS3Configured}.
 */
export function getS3Client(): S3Client | null {
  if (!isS3Configured()) return null;
  return s3Client;
}
