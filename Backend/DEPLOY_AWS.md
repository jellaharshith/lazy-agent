# AWS deployment notes (incremental)

This backend stays runnable on any Node host. AWS pieces are **optional**: OpenAI remains the primary intake path; Bedrock and S3 activate only when configured.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Static credentials for Bedrock/S3 (local dev or non-IAM environments). |
| `AWS_SESSION_TOKEN` | Optional; use with temporary credentials. |
| `AWS_REGION` / `AWS_DEFAULT_REGION` | Used by the **S3** client (defaults to `us-east-1` if unset). |
| `BEDROCK_ENABLED` | Set to `true` on Elastic Beanstalk (or other IAM-role hosts) when you are **not** using static keys. Set to `false` to force-disable Bedrock. If unset, Bedrock is enabled only when access key + secret are present. |
| `BEDROCK_CLASSIFY_MODEL_ID` | Bedrock model or inference profile ID (default: `anthropic.claude-3-haiku-20240307-v1:0`). |
| `BEDROCK_COMPARE_INTAKE` | Set to `true` to run a lightweight Bedrock classification in parallel with intake and append a cross-check sentence to `reasoning_summary` when it disagrees with OpenAI. |
| `S3_AUDIO_BUCKET` | Bucket name for optional MP3 uploads. |
| `S3_AUDIO_PREFIX` | Optional key prefix (no leading slash). |
| `S3_PUBLIC_BASE_URL` | Optional CDN or static-site base URL for public file URLs (no trailing slash). |
| `S3_UPLOAD_VOICE_TTS` | Set to `true` to upload ElevenLabs MP3 output from `generateVoiceMessage` when the bucket is configured. |

Existing variables (`OPENAI_API_KEY`, `PORT`, Supabase, Twilio, etc.) are unchanged.

## Amazon Bedrock

1. In **us-east-1**, enable access to your chosen foundation model in the Bedrock console (model access).
2. Attach an IAM policy to the instance role (or user) allowing `bedrock:InvokeModel` on the model ARN or `foundation-model/*` as appropriate for your demo scope.
3. Set `BEDROCK_CLASSIFY_MODEL_ID` if your account uses a different model ID or inference profile.
4. On **Elastic Beanstalk**, set `BEDROCK_ENABLED=true` so Bedrock runs using the instance profile without embedding access keys.

## Amazon S3 (voice / future media)

1. Create a bucket in the region that matches `AWS_REGION` (or leave default `us-east-1`).
2. Grant the app IAM identity `s3:PutObject` (and `s3:GetObject` if you serve files publicly) on `arn:aws:s3:::your-bucket/*`.
3. Set `S3_AUDIO_BUCKET`. For public playback URLs (e.g. Twilio `<Play>`), configure bucket policy, CloudFront, or `S3_PUBLIC_BASE_URL` accordingly.

## Elastic Beanstalk (high level)

1. Use the Node.js platform; set **Start command** to match production (e.g. `node Backend/index.js` after `tsc` build, or your existing process manager command — keep parity with local `npm run` scripts once compiled).
2. Add environment properties for secrets and the variables above; never commit `.env`.
3. Ensure the instance profile has Bedrock invoke + S3 permissions if you use those features.
4. Health check: default HTTP on your `PORT` (often set via `PORT` env on EB).

For a hackathon, running the API on EB with OpenAI-only env vars is enough; enable Bedrock/S3 when you want to demo AWS on stage.
