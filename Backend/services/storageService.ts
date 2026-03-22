import { PutObjectCommand } from "@aws-sdk/client-s3";
import {
  s3Client,
  isS3Configured,
  S3_BUCKET_NAME,
  S3_AUDIO_PREFIX,
  S3_PUBLIC_BASE_URL,
} from "../config/s3";

export type UploadFileResult = {
  bucket: string;
  key: string;
  /** HTTPS, CDN, or `s3://` — may need bucket policy / CloudFront for public playback. */
  url: string;
};

/** @deprecated Use {@link UploadFileResult}. */
export type UploadAudioResult = UploadFileResult;

export type UploadBufferToS3Input = {
  buffer: Buffer;
  key: string;
  contentType: string;
};

export type UploadBufferToS3Success = {
  success: true;
  key: string;
  bucket: string;
  url: string;
};

export type UploadBufferToS3Failure = {
  success: false;
  message: string;
};

export type UploadBufferToS3Result = UploadBufferToS3Success | UploadBufferToS3Failure;

function normalizeKey(key: string): string {
  const k = key.replace(/^\/+/, "").trim();
  if (!k) throw new Error("S3 key must be non-empty");
  if (S3_AUDIO_PREFIX) {
    return `${S3_AUDIO_PREFIX}/${k}`.replace(/\/+/g, "/");
  }
  return k;
}

function urlForFullKey(fullKey: string): string {
  if (S3_PUBLIC_BASE_URL) {
    return `${S3_PUBLIC_BASE_URL}/${encodeURI(fullKey)}`;
  }
  return `s3://${S3_BUCKET_NAME}/${fullKey}`;
}

/**
 * Public URL (or `s3://`) for an object key, applying the same prefix rules as uploads.
 */
export function buildPublicFileUrl(key: string): string {
  const fullKey = normalizeKey(key);
  return urlForFullKey(fullKey);
}

/**
 * Upload raw bytes to S3. Does not throw; returns a safe failure object on missing config or errors.
 */
export async function uploadBufferToS3(input: UploadBufferToS3Input): Promise<UploadBufferToS3Result> {
  if (!isS3Configured()) {
    return { success: false, message: "S3 upload unavailable" };
  }

  let fullKey: string;
  try {
    fullKey = normalizeKey(input.key);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[s3] uploadBufferToS3 invalid key:", msg);
    return { success: false, message: "S3 upload unavailable" };
  }

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: fullKey,
        Body: input.buffer,
        ContentType: input.contentType,
      })
    );
    return {
      success: true,
      key: fullKey,
      bucket: S3_BUCKET_NAME,
      url: urlForFullKey(fullKey),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[s3] uploadBufferToS3 failed:", msg);
    return { success: false, message: "S3 upload unavailable" };
  }
}

export type UploadFileOptions = {
  contentType?: string;
};

/**
 * Upload arbitrary bytes to S3. Returns null if the bucket is not configured or the upload fails (caller continues).
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  options?: UploadFileOptions
): Promise<UploadFileResult | null> {
  const contentType = options?.contentType ?? "application/octet-stream";
  const result = await uploadBufferToS3({ buffer, key, contentType });
  if (!result.success) return null;
  return { bucket: result.bucket, key: result.key, url: result.url };
}

/**
 * Upload raw audio bytes (e.g. MP3). No-op path: returns null if S3 is not configured or upload fails.
 */
export async function uploadAudioToS3(
  buffer: Buffer,
  key: string
): Promise<UploadAudioResult | null> {
  return uploadFile(buffer, key, { contentType: "audio/mpeg" });
}
