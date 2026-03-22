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

/** Rich intake analysis (orchestration layer — no external APIs besides OpenAI). */
export interface SearchIntent {
  keywords: string[];
  priority_types: string[];
  user_preference: string | null;
  free_food_preferred: boolean;
  cheap_food_preferred: boolean;
}

export interface IntakeUiContent {
  message: string;
  summary: string;
}

export interface IntakeStorageTags {
  category: string | null;
  priority_score: number | null;
  request_label: string | null;
  preference_text: string | null;
}

export interface IntakeAiAnalysis {
  need_type: NeedType;
  urgency: UrgencyLevel;
  confidence: number;
  source: ClassificationSource;
  search_intent: SearchIntent;
  ui_content: IntakeUiContent;
  storage_tags: IntakeStorageTags;
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

function defaultSearchIntent(): SearchIntent {
  return {
    keywords: ["food bank", "community kitchen", "restaurant", "supermarket"],
    priority_types: ["food_bank", "community_kitchen", "restaurant", "supermarket"],
    user_preference: null,
    free_food_preferred: false,
    cheap_food_preferred: false,
  };
}

function defaultUiContent(needType: string): IntakeUiContent {
  const t = needType.toLowerCase();
  if (t === "food") {
    return {
      message: "We found a meal available nearby.",
      summary: "Food need detected and matched to a nearby discounted food option.",
    };
  }
  return {
    message: "We received your request.",
    summary: "Your need was understood and recorded.",
  };
}

function defaultStorageTags(): IntakeStorageTags {
  return {
    category: null,
    priority_score: null,
    request_label: null,
    preference_text: null,
  };
}

function intakeAnalysisFromBasic(
  n: NeedClassification,
  source: ClassificationSource
): IntakeAiAnalysis {
  return {
    need_type: n.need_type,
    urgency: n.urgency,
    confidence: n.confidence,
    source,
    search_intent: defaultSearchIntent(),
    ui_content: defaultUiContent(n.need_type),
    storage_tags: defaultStorageTags(),
  };
}

function buildOpenAIRichIntakePrompt(rawText: string): string {
  return `You are an assistant for a surplus food marketplace. Analyze the user's message and return ONLY valid JSON with this shape (no markdown):
{
  "need_type": "food | financial | emotional | none",
  "urgency": "low | medium | high",
  "confidence": number,
  "search_intent": {
    "keywords": string[],
    "priority_types": string[],
    "user_preference": string | null,
    "free_food_preferred": boolean,
    "cheap_food_preferred": boolean
  },
  "ui_content": {
    "message": string,
    "summary": string
  },
  "storage_tags": {
    "category": string | null,
    "priority_score": number | null,
    "request_label": string | null,
    "preference_text": string | null
  }
}
Rules:
- priority_types should be a subset of: food_bank, community_kitchen, restaurant, fast_food, supermarket, grocery_store.
- keywords should help find nearby places (short phrases).
- If the user mentions cuisine (e.g. Indian), put it in storage_tags.preference_text and search_intent.user_preference.
- ui_content should be short, friendly, demo-ready.

User message:
${rawText}`;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function normalizeIntakeAnalysis(parsed: unknown, source: ClassificationSource): IntakeAiAnalysis | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;
  const { need_type, urgency, confidence } = o;
  if (!isNeedType(need_type) || !isUrgency(urgency)) return null;
  const c =
    typeof confidence === "number"
      ? confidence
      : typeof confidence === "string"
        ? Number(confidence)
        : NaN;
  if (!Number.isFinite(c) || c < 0 || c > 1) return null;

  const si = o.search_intent && typeof o.search_intent === "object" && !Array.isArray(o.search_intent)
    ? (o.search_intent as Record<string, unknown>)
    : null;
  const keywords = si && isStringArray(si.keywords) ? si.keywords : defaultSearchIntent().keywords;
  const priorityTypes =
    si && isStringArray(si.priority_types) ? si.priority_types : defaultSearchIntent().priority_types;
  const userPref =
    si && typeof si.user_preference === "string"
      ? si.user_preference
      : si && si.user_preference === null
        ? null
        : null;
  const freePref = si && typeof si.free_food_preferred === "boolean" ? si.free_food_preferred : false;
  const cheapPref = si && typeof si.cheap_food_preferred === "boolean" ? si.cheap_food_preferred : false;

  const ui = o.ui_content && typeof o.ui_content === "object" && !Array.isArray(o.ui_content)
    ? (o.ui_content as Record<string, unknown>)
    : null;
  const msg =
    ui && typeof ui.message === "string" && ui.message.trim()
      ? ui.message.trim()
      : defaultUiContent(need_type).message;
  const sum =
    ui && typeof ui.summary === "string" && ui.summary.trim()
      ? ui.summary.trim()
      : defaultUiContent(need_type).summary;

  const st = o.storage_tags && typeof o.storage_tags === "object" && !Array.isArray(o.storage_tags)
    ? (o.storage_tags as Record<string, unknown>)
    : null;
  const category =
    st == null
      ? null
      : typeof st.category === "string"
        ? st.category
        : st.category === null
          ? null
          : null;
  const priorityScore =
    st != null && typeof st.priority_score === "number" && Number.isFinite(st.priority_score)
      ? Math.round(st.priority_score)
      : st?.priority_score === null
        ? null
        : null;
  const requestLabel =
    st == null
      ? null
      : typeof st.request_label === "string"
        ? st.request_label
        : st.request_label === null
          ? null
          : null;
  const prefText =
    st == null
      ? null
      : typeof st.preference_text === "string"
        ? st.preference_text
        : st.preference_text === null
          ? null
          : null;

  return {
    need_type,
    urgency,
    confidence: c,
    source,
    search_intent: {
      keywords,
      priority_types: priorityTypes,
      user_preference: userPref,
      free_food_preferred: freePref,
      cheap_food_preferred: cheapPref,
    },
    ui_content: { message: msg, summary: sum },
    storage_tags: {
      category,
      priority_score: priorityScore,
      request_label: requestLabel,
      preference_text: prefText,
    },
  };
}

async function fetchBasicOpenAIClassification(rawText: string): Promise<NeedClassification> {
  const trimmed = rawText.trim();
  const userPrompt = buildOpenAIClassificationPrompt(trimmed);
  const completion = await openaiClient.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.2,
    max_tokens: 256,
    messages: [{ role: "user", content: userPrompt }],
  });
  const rawTextOut = completion.choices[0]?.message?.content?.trim() ?? "";
  try {
    const parsed = parseClassificationFromModelOutput(rawTextOut, "openai", "OpenAI classify");
    return { need_type: parsed.need_type, urgency: parsed.urgency, confidence: parsed.confidence };
  } catch {
    return { need_type: "none", urgency: "low", confidence: 0.5 };
  }
}

/**
 * Full AI intake analysis: intent, preferences, UI copy, and DB tags.
 * Does not call Google or DB — only OpenAI.
 */
export async function analyzeIntakeNeed(rawText: string): Promise<IntakeAiAnalysis> {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error("rawText must be non-empty");
  }

  const userPrompt = buildOpenAIRichIntakePrompt(trimmed);
  console.log("[ai] analyzeIntakeNeed: provider used: openai");

  let rawTextOut: string;
  try {
    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.2,
      max_tokens: 1024,
      messages: [{ role: "user", content: userPrompt }],
    });
    rawTextOut = completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    logError("[ai] analyzeIntakeNeed (chat.completions.create)", err);
    throw err;
  }

  console.log("[ai] analyzeIntakeNeed: raw model response:", rawTextOut);

  try {
    const jsonStr = extractJsonObjectString(rawTextOut);
    if (!jsonStr) throw new Error("no JSON object");
    const parsed: unknown = JSON.parse(jsonStr);
    const normalized = normalizeIntakeAnalysis(parsed, "openai");
    if (normalized) {
      console.log("[ai] analyzeIntakeNeed: parsed rich result");
      return normalized;
    }
  } catch (err) {
    logError("[ai] analyzeIntakeNeed (parse rich)", err);
  }

  try {
    const basic = await fetchBasicOpenAIClassification(trimmed);
    return intakeAnalysisFromBasic(basic, "openai");
  } catch (err) {
    logError("[ai] analyzeIntakeNeed (fallback basic)", err);
    return intakeAnalysisFromBasic(
      { need_type: "none", urgency: "low", confidence: 0.5 },
      "openai"
    );
  }
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
  try {
    const a = await analyzeIntakeNeed(rawText);
    return {
      need_type: a.need_type,
      urgency: a.urgency,
      confidence: a.confidence,
      source: a.source,
    };
  } catch (err) {
    logError("[ai] classifyNeedWithOpenAI", err);
    return classificationFallback("openai");
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
