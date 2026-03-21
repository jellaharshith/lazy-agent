import { inspect } from "util";
import type { GenerateContentResult } from "@google/generative-ai";
import { geminiModel } from "../config/gemini";
import { client as openaiClient } from "../config/openai";

export type NeedType = "food" | "financial" | "emotional" | "none";
export type UrgencyLevel = "low" | "medium" | "high";
export type ClassificationSource = "gemini" | "openai";

export interface NeedClassification {
  need_type: NeedType;
  urgency: UrgencyLevel;
  confidence: number;
}

export interface ClassifiedNeed extends NeedClassification {
  source: ClassificationSource;
}

const NEED_TYPES: readonly NeedType[] = ["food", "financial", "emotional", "none"];
const URGENCY_LEVELS: readonly UrgencyLevel[] = ["low", "medium", "high"];

const OPENAI_MODEL =
  process.env.OPENAI_CLASSIFY_MODEL?.trim() || "gpt-4o-mini";

const STRICT_JSON_SYSTEM =
  "You must respond with strict JSON only. No markdown, no code fences, no explanation, no text before or after the JSON object.";

function buildOpenAIClassificationPrompt(rawText: string): string {
  return `Return ONLY valid JSON in this format:
{
  "need_type": "food | financial | emotional | none",
  "urgency": "low | medium | high",
  "confidence": number
}
Analyze the user's message and classify the likely need.
User message: ${rawText}`;
}

function buildClassificationUserPrompt(rawText: string): string {
  return `You are an AI classifier. Analyze the user's message and return ONLY a JSON object with exactly these keys:
- "need_type": one of "food", "financial", "emotional", "none"
- "urgency": one of "low", "medium", "high"
- "confidence": a number from 0 to 1

User message:
${rawText}`;
}

/**
 * Strip ```json / ``` markdown fences (full wrap or leading/trailing only).
 */
export function stripMarkdownCodeFences(text: string): string {
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

function isNeedType(v: unknown): v is NeedType {
  return typeof v === "string" && (NEED_TYPES as readonly string[]).includes(v);
}

function isUrgency(v: unknown): v is UrgencyLevel {
  return typeof v === "string" && (URGENCY_LEVELS as readonly string[]).includes(v);
}

function normalizeClassification(parsed: unknown): NeedClassification | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const o = parsed as Record<string, unknown>;
  const { need_type, urgency, confidence } = o;

  if (!isNeedType(need_type) || !isUrgency(urgency)) {
    return null;
  }

  const c =
    typeof confidence === "number"
      ? confidence
      : typeof confidence === "string"
        ? Number(confidence)
        : NaN;

  if (!Number.isFinite(c) || c < 0 || c > 1) {
    return null;
  }

  return { need_type, urgency, confidence: c };
}

function logError(label: string, err: unknown): void {
  console.error(`${label} caught error object:`, err);
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`${label} caught error message:`, msg);
  if (err instanceof Error && err.stack) {
    console.error(`${label} stack trace:`, err.stack);
  } else {
    try {
      console.error(`${label} inspected:`, inspect(err, { depth: 6 }));
    } catch {
      /* ignore */
    }
  }
}

function parseClassificationFromModelOutput(
  rawModelOutput: string,
  source: ClassificationSource,
  label: string
): ClassifiedNeed {
  if (!rawModelOutput.trim()) {
    throw new Error(`${label}: empty model output`);
  }

  const jsonStr = extractJsonObjectString(rawModelOutput);
  if (!jsonStr) {
    throw new Error(`${label}: no JSON object in response`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`${label}: JSON parse failed — ${msg}`);
  }

  const normalized = normalizeClassification(parsed);
  if (!normalized) {
    throw new Error(`${label}: invalid classification shape`);
  }

  return { ...normalized, source };
}

function classificationFallback(source: ClassificationSource): ClassifiedNeed {
  return {
    need_type: "none",
    urgency: "low",
    confidence: 0.5,
    source,
  };
}

/** Read text from a generateContent result without relying only on .text() (handles edge cases). */
export function getModelResponseText(result: GenerateContentResult): string {
  const response = result.response;

  const blockReason = response.promptFeedback?.blockReason;
  if (blockReason && blockReason !== "BLOCKED_REASON_UNSPECIFIED") {
    throw new Error(`Prompt blocked: ${String(blockReason)}`);
  }

  const candidates = response.candidates;
  if (!candidates?.length) {
    throw new Error("No candidates in Gemini response");
  }

  const fromParts = (): string => {
    const parts = candidates[0]?.content?.parts;
    return (
      parts
        ?.map((p) => ("text" in p && typeof p.text === "string" ? p.text : ""))
        .filter(Boolean)
        .join("") ?? ""
    );
  };

  let combined = "";
  try {
    combined = response.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const partsText = fromParts();
    if (partsText.trim()) {
      return partsText;
    }
    throw new Error(`Could not read Gemini response text: ${msg}`);
  }

  if (combined.trim()) {
    return combined;
  }

  const fallback = fromParts();
  if (fallback.trim()) {
    return fallback;
  }

  throw new Error(
    "Empty response text from Gemini (no text in candidates; check safety blocks or model output)"
  );
}

export async function classifyNeedWithOpenAI(rawText: string): Promise<ClassifiedNeed> {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error("rawText must be non-empty");
  }

  const userPrompt = buildOpenAIClassificationPrompt(trimmed);
  console.log("[ai] classifyNeedWithOpenAI: provider used: openai");

  let rawTextOut: string;
  try {
    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.2,
      max_tokens: 256,
      messages: [{ role: "user", content: userPrompt }],
    });
    rawTextOut = completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    logError("[ai] classifyNeedWithOpenAI (chat.completions.create)", err);
    throw err;
  }

  console.log("[ai] classifyNeedWithOpenAI: raw model response:", rawTextOut);

  try {
    const out = parseClassificationFromModelOutput(
      rawTextOut,
      "openai",
      "OpenAI classify"
    );
    console.log("[ai] classifyNeedWithOpenAI: parsed result:", out);
    return out;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError("[ai] classifyNeedWithOpenAI (parse)", err);
    console.error("[ai] classifyNeedWithOpenAI: caught error message:", msg);
    const fallback = classificationFallback("openai");
    console.log("[ai] classifyNeedWithOpenAI: using fallback:", fallback);
    return fallback;
  }
}

export async function classifyNeedWithGemini(rawText: string): Promise<ClassifiedNeed> {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error("rawText must be non-empty");
  }

  const prompt = buildClassificationUserPrompt(trimmed);
  console.log("[ai] classifyNeedWithGemini: provider used: gemini");

  let result: GenerateContentResult;
  try {
    result = await geminiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: `${STRICT_JSON_SYSTEM}\n\n${prompt}` }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 256,
        responseMimeType: "application/json",
      },
    });
  } catch (err) {
    logError("[ai] classifyNeedWithGemini (generateContent)", err);
    throw err;
  }

  let rawTextOut: string;
  try {
    rawTextOut = getModelResponseText(result);
  } catch (err) {
    logError("[ai] classifyNeedWithGemini (read response text)", err);
    throw err;
  }

  console.log("[ai] classifyNeedWithGemini: raw model response:", rawTextOut);

  try {
    const out = parseClassificationFromModelOutput(
      rawTextOut,
      "gemini",
      "Gemini classify"
    );
    console.log("[ai] classifyNeedWithGemini: parsed result:", out);
    return out;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError("[ai] classifyNeedWithGemini (parse)", err);
    console.error("[ai] classifyNeedWithGemini: caught error message:", msg);
    const fallback = classificationFallback("gemini");
    console.log("[ai] classifyNeedWithGemini: using fallback:", fallback);
    return fallback;
  }
}

/** Primary entry: OpenAI classifier (hackathon default). */
export async function classifyNeed(rawText: string): Promise<ClassifiedNeed> {
  console.log("[ai] classifyNeed: delegating to OpenAI");
  return classifyNeedWithOpenAI(rawText);
}

export type PingGeminiResult = {
  raw: string;
  parsed: unknown | null;
  parseError: string | null;
};

const PING_USER = 'Return only {"ok": true}';

function parsePingJson(raw: string): { parsed: unknown | null; parseError: string | null } {
  const stripped = stripMarkdownCodeFences(raw).trim();
  try {
    const jsonStr = extractJsonObjectString(raw) ?? stripped;
    const parsed: unknown = JSON.parse(jsonStr);
    return { parsed, parseError: null };
  } catch (err) {
    logError("[ai] ping (JSON.parse)", err);
    const msg = err instanceof Error ? err.message : String(err);
    return { parsed: null, parseError: msg };
  }
}

/** Minimal Gemini call for GET /api/ai/ping debugging. */
export async function pingGemini(): Promise<PingGeminiResult> {
  console.log("[ai] pingGemini: provider used: gemini");

  let result: GenerateContentResult;
  try {
    result = await geminiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: PING_USER }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 64,
        responseMimeType: "application/json",
      },
    });
  } catch (err) {
    logError("[ai] pingGemini (generateContent)", err);
    throw err;
  }

  let raw: string;
  try {
    raw = getModelResponseText(result);
  } catch (err) {
    logError("[ai] pingGemini (read response text)", err);
    throw err;
  }

  console.log("[ai] pingGemini: raw model response:", raw);
  const { parsed, parseError } = parsePingJson(raw);
  if (parseError === null) {
    console.log("[ai] pingGemini: parsed result:", parsed);
  } else {
    console.error("[ai] pingGemini: caught error message:", parseError);
  }
  return { raw, parsed, parseError };
}
