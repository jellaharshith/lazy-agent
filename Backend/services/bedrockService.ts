import {
  InvokeModelCommand,
  type BedrockRuntimeClient,
} from "@aws-sdk/client-bedrock-runtime";
import {
  bedrockRuntimeClient,
  BEDROCK_CLASSIFY_MODEL_ID,
  BEDROCK_MODEL_ID,
  isBedrockConfigured,
} from "../config/bedrock";
import type { NeedType, UrgencyLevel } from "./aiService";

/** Returned when any Bedrock API invocation fails (access, network, throttling, etc.). */
export const BEDROCK_UNAVAILABLE = {
  success: false as const,
  error: "bedrock_unavailable" as const,
};

export type BedrockUnavailable = typeof BEDROCK_UNAVAILABLE;

export function isBedrockUnavailable(v: unknown): v is BedrockUnavailable {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as { success?: unknown }).success === false &&
    (v as { error?: unknown }).error === "bedrock_unavailable"
  );
}

function awsErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const n = "name" in err && typeof err.name === "string" ? err.name : "Error";
    return `${n}: ${err.message}`;
  }
  return String(err);
}

function logBedrockUnavailable(err: unknown): void {
  console.warn("Bedrock unavailable");
  console.warn(awsErrorMessage(err));
}

export type BedrockClassifyInput = {
  rawText: string;
};

export type BedrockClassification = {
  need_type: NeedType;
  urgency: UrgencyLevel;
  confidence: number;
  reasoning?: string;
};

const NEED_TYPES = new Set<string>(["food", "financial", "emotional", "none"]);
const URGENCY_LEVELS = new Set<string>(["low", "medium", "high"]);

function getClient(): BedrockRuntimeClient | null {
  if (!isBedrockConfigured()) return null;
  return bedrockRuntimeClient;
}

function stripMarkdownCodeFences(text: string): string {
  let t = text.trim();
  const fullWrap = /^```(?:json)?\s*([\s\S]*?)\s*```$/im.exec(t);
  if (fullWrap?.[1]) {
    return fullWrap[1].trim();
  }
  t = t.replace(/^```(?:json)?\s*/i, "");
  t = t.replace(/\s*```$/i, "");
  return t.trim();
}

function extractJsonObjectString(text: string): string | null {
  const t = stripMarkdownCodeFences(text).trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return t.slice(start, end + 1);
}

function normalizeBedrockClassification(parsed: unknown): BedrockClassification | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;
  const need_type = o.need_type;
  const urgency = o.urgency;
  const confidence = o.confidence;
  if (typeof need_type !== "string" || !NEED_TYPES.has(need_type)) return null;
  if (typeof urgency !== "string" || !URGENCY_LEVELS.has(urgency)) return null;
  const c =
    typeof confidence === "number"
      ? confidence
      : typeof confidence === "string"
        ? Number(confidence)
        : NaN;
  if (!Number.isFinite(c) || c < 0 || c > 1) return null;
  const reasoning =
    typeof o.reasoning === "string" && o.reasoning.trim() ? o.reasoning.trim() : undefined;
  return {
    need_type: need_type as NeedType,
    urgency: urgency as UrgencyLevel,
    confidence: c,
    reasoning,
  };
}

/**
 * Invokes the classify model on Bedrock. On any failure, logs and returns {@link BEDROCK_UNAVAILABLE}.
 */
async function invokeClaudeMessages(userText: string): Promise<string | BedrockUnavailable> {
  try {
    const c = getClient();
    if (!c) {
      throw new Error("Bedrock client unavailable");
    }

    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1200,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: userText }],
        },
      ],
    });

    const out = await c.send(
      new InvokeModelCommand({
        modelId: BEDROCK_CLASSIFY_MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: new TextEncoder().encode(body),
      })
    );

    const raw = out.body ? new TextDecoder().decode(out.body) : "";
    if (!raw.trim()) {
      throw new Error("Empty Bedrock response body");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Bedrock response was not JSON");
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Invalid Bedrock response shape");
    }

    const content = (parsed as Record<string, unknown>).content;
    if (!Array.isArray(content) || content.length === 0) {
      throw new Error("Bedrock response missing content");
    }

    const first = content[0] as Record<string, unknown>;
    if (first.type === "text" && typeof first.text === "string") {
      return first.text;
    }

    throw new Error("Bedrock response content was not text");
  } catch (err) {
    logBedrockUnavailable(err);
    return BEDROCK_UNAVAILABLE;
  }
}

/**
 * Lightweight classifier on Bedrock (JSON: need_type, urgency, confidence, optional reasoning).
 * Returns null if Bedrock is disabled, misconfigured, or the response cannot be parsed.
 * Returns {@link BEDROCK_UNAVAILABLE} if the Bedrock API call fails.
 */
export async function classifyWithBedrock(
  input: BedrockClassifyInput
): Promise<BedrockClassification | BedrockUnavailable | null> {
  const trimmed = typeof input.rawText === "string" ? input.rawText.trim() : "";
  if (!trimmed) return null;
  if (!isBedrockConfigured()) return null;

  const userText = `You are a need classifier for a surplus-food assistance app.
Return ONLY valid JSON (no markdown fences) with exactly these keys:
- "need_type": one of "food", "financial", "emotional", "none"
- "urgency": one of "low", "medium", "high"
- "confidence": number from 0 to 1
- "reasoning": optional short string explaining the classification

User message:
${trimmed.slice(0, 8000)}`;

  try {
    const text = await invokeClaudeMessages(userText);
    if (isBedrockUnavailable(text)) return text;
    const jsonStr = extractJsonObjectString(text);
    if (!jsonStr) return null;
    const parsed: unknown = JSON.parse(jsonStr);
    return normalizeBedrockClassification(parsed);
  } catch (err) {
    logBedrockUnavailable(err);
    return BEDROCK_UNAVAILABLE;
  }
}

/**
 * Same Claude path as {@link classifyWithBedrock}, but sends an arbitrary user prompt (e.g. full intake JSON spec).
 * Returns raw assistant text, empty string when disabled/empty prompt, or {@link BEDROCK_UNAVAILABLE} on API failure.
 */
export async function invokeBedrockUserPrompt(
  userPrompt: string
): Promise<string | BedrockUnavailable> {
  if (!isBedrockConfigured()) return "";
  const trimmed = userPrompt.trim();
  if (!trimmed) return "";
  try {
    const text = await invokeClaudeMessages(
      `${STRICT_JSON_PREFIX}\n\n${trimmed.slice(0, 12000)}`
    );
    if (isBedrockUnavailable(text)) return text;
    return text.trim();
  } catch (err) {
    logBedrockUnavailable(err);
    return BEDROCK_UNAVAILABLE;
  }
}

const STRICT_JSON_PREFIX =
  "You must respond with strict JSON only. No markdown, no code fences, no explanation, no text before or after the JSON object.";

const BEDROCK_TEST_PROMPT = "Say hello in one short sentence";

/**
 * Minimal Bedrock smoke test (Anthropic Messages API on Bedrock).
 * Uses AWS_REGION, BEDROCK_MODEL_ID, and default credential chain (incl. static keys + session token).
 */
export async function testBedrock(): Promise<
  { success: true; raw: string; parsed: string } | BedrockUnavailable
> {
  try {
    if (!isBedrockConfigured()) {
      logBedrockUnavailable(new Error("Bedrock not configured"));
      return BEDROCK_UNAVAILABLE;
    }

    const region = process.env.AWS_REGION?.trim() || "us-east-1";
    const modelId = BEDROCK_MODEL_ID;
    console.log("[bedrock-test] region:", region, "modelId:", modelId);

    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: BEDROCK_TEST_PROMPT }],
        },
      ],
    });

    try {
      const response = await bedrockRuntimeClient.send(
        new InvokeModelCommand({
          modelId,
          contentType: "application/json",
          accept: "application/json",
          body: new TextEncoder().encode(body),
        })
      );

      const raw = response.body ? new TextDecoder().decode(response.body) : "";
      let parsed = "";
      try {
        const json = JSON.parse(raw) as {
          content?: Array<{ type?: string; text?: string }>;
        };
        const first = json.content?.[0];
        if (first?.type === "text" && typeof first.text === "string") {
          parsed = first.text;
        } else {
          parsed = raw;
        }
      } catch {
        parsed = raw;
      }

      console.log("[bedrock-test] raw response:", raw);
      console.log("[bedrock-test] parsed output:", parsed);

      return { success: true, raw, parsed };
    } catch (err) {
      logBedrockUnavailable(err);
      return BEDROCK_UNAVAILABLE;
    }
  } catch (err) {
    logBedrockUnavailable(err);
    return BEDROCK_UNAVAILABLE;
  }
}
