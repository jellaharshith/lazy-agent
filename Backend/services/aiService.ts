import { inspect } from "util";
import type { GenerateContentResult } from "@google/generative-ai";
import { geminiModel } from "../config/gemini";
import { client as openaiClient } from "../config/openai";
import type { HfClassificationResult } from "./hfService";
import { classifyWithHF } from "./hfService";
import { isBedrockConfigured } from "../config/bedrock";
import {
  classifyWithBedrock,
  invokeBedrockUserPrompt,
  isBedrockUnavailable,
} from "./bedrockService";

export type NeedType = "food" | "financial" | "emotional" | "none";
export type UrgencyLevel = "low" | "medium" | "high";
export type ClassificationSource = "gemini" | "openai" | "bedrock" | "hf" | "fallback";

export interface NeedClassification {
  need_type: NeedType;
  urgency: UrgencyLevel;
  confidence: number;
}

export interface ClassifiedNeed extends NeedClassification {
  source: ClassificationSource;
}

/** Rich intake analysis — OpenAI primary, Hugging Face optional helper. */
export interface SearchIntent {
  keywords: string[];
  priority_types: string[];
  user_preference: string | null;
  cuisine_preference: string | null;
  free_food_preferred: boolean;
  cheap_food_preferred: boolean;
  nearby_required: boolean;
}

export interface RankingHints {
  prioritize_distance: boolean;
  prioritize_low_price: boolean;
  prioritize_soon_expiring: boolean;
  prioritize_free_food: boolean;
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

/** Candidate snapshot passed into OpenAI (not authoritative for ranking). */
export interface NearbyCandidateForAi {
  title: string;
  type: string;
  distanceKm?: number;
  discountedPrice?: number | null;
  originalPrice?: number | null;
  expiresAt?: string | null;
  source?: string;
}

export interface AnalyzeNeedInput {
  rawText: string;
  /** When the client knows the actor (optional; default assume seeker). */
  role?: "seeker" | "provider";
  lat?: number;
  lng?: number;
  nearbyCandidates?: NearbyCandidateForAi[];
}

export interface IntakeAiAnalysis {
  need_type: NeedType;
  urgency: UrgencyLevel;
  confidence: number;
  source: ClassificationSource;
  hf_labels: HfClassificationResult | null;
  search_intent: SearchIntent;
  ranking_hints: RankingHints;
  ui_content: IntakeUiContent;
  storage_tags: IntakeStorageTags;
  reasoning_summary: string;
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
    keywords: [
      "food bank",
      "community kitchen",
      "grocery",
      "bakery",
      "restaurant",
      "supermarket",
    ],
    priority_types: [
      "food_bank",
      "community_kitchen",
      "restaurant",
      "fast_food",
      "bakery",
      "cafe",
      "grocery",
      "supermarket",
    ],
    user_preference: null,
    cuisine_preference: null,
    free_food_preferred: false,
    cheap_food_preferred: false,
    nearby_required: false,
  };
}

function defaultRankingHints(): RankingHints {
  return {
    prioritize_distance: false,
    prioritize_low_price: false,
    prioritize_soon_expiring: false,
    prioritize_free_food: false,
  };
}

function hfTopToNeedType(top: string): NeedType {
  const t = top.toLowerCase().trim();
  if (t === "food" || t === "financial" || t === "emotional" || t === "none") return t;
  return "none";
}

function logHfOpenAiDisagreement(
  hf: HfClassificationResult | null,
  openaiNeed: NeedType
): void {
  if (!hf) return;
  const hfType = hfTopToNeedType(hf.top_label);
  const topScore = Math.max(...Object.values(hf.scores));
  if (topScore >= 0.65 && hfType !== openaiNeed) {
    console.warn("[ai] HF disagrees with OpenAI need_type:", {
      hf_top: hf.top_label,
      hf_type: hfType,
      openai: openaiNeed,
      hf_confidence: topScore.toFixed(3),
    });
  }
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
  source: ClassificationSource,
  hfLabels: HfClassificationResult | null,
  reasoningSummaryOverride?: string
): IntakeAiAnalysis {
  return {
    need_type: n.need_type,
    urgency: n.urgency,
    confidence: n.confidence,
    source,
    hf_labels: hfLabels,
    search_intent: defaultSearchIntent(),
    ranking_hints: defaultRankingHints(),
    ui_content: defaultUiContent(n.need_type),
    storage_tags: defaultStorageTags(),
    reasoning_summary:
      reasoningSummaryOverride?.trim() ||
      "Reduced analysis from primary classifier (rich JSON parse failed).",
  };
}

function intakeAnalysisFromHfHelper(hf: HfClassificationResult): IntakeAiAnalysis {
  const needType = hfTopToNeedType(hf.top_label);
  const tl = hf.top_label.toLowerCase().trim();
  const key =
    tl === "food" || tl === "financial" || tl === "emotional" || tl === "none" ? tl : null;
  const rawScore =
    key != null ? hf.scores[key] : Math.max(...Object.values(hf.scores));
  const confidence = typeof rawScore === "number" && Number.isFinite(rawScore) ? rawScore : 0.55;
  return {
    need_type: needType,
    urgency: needType === "food" ? "medium" : "low",
    confidence: Math.max(0.35, Math.min(0.92, confidence)),
    source: "hf",
    hf_labels: hf,
    search_intent: defaultSearchIntent(),
    ranking_hints: defaultRankingHints(),
    ui_content: defaultUiContent(needType),
    storage_tags: defaultStorageTags(),
    reasoning_summary: "Auxiliary Hugging Face classification (OpenAI unavailable).",
  };
}

function fullFallbackAnalysis(hfLabels: HfClassificationResult | null): IntakeAiAnalysis {
  return {
    need_type: "none",
    urgency: "low",
    confidence: 0.5,
    source: "fallback",
    hf_labels: hfLabels,
    search_intent: defaultSearchIntent(),
    ranking_hints: defaultRankingHints(),
    ui_content: defaultUiContent("none"),
    storage_tags: defaultStorageTags(),
    reasoning_summary: "Safe fallback — models unavailable or unparseable.",
  };
}

function buildAnalyzeNeedUserPrompt(input: AnalyzeNeedInput): string {
  const trimmed = input.rawText.trim();
  const ctxLines: string[] = [];

  const roleLine =
    input.role === "provider"
      ? 'Role: provider (user may be describing surplus they list — infer categories seekers would match).'
      : input.role === "seeker"
        ? "Role: seeker (user is looking for food or help obtaining food)."
        : "Role: unspecified — assume seeker unless text clearly describes donating/listing surplus.";
  ctxLines.push(roleLine);

  if (
    input.lat != null &&
    input.lng != null &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng)
  ) {
    ctxLines.push(`User location (lat, lng): ${input.lat}, ${input.lng}.`);
  }
  const cands = input.nearbyCandidates ?? [];
  if (cands.length > 0) {
    ctxLines.push("Nearby options (hints only — server ranks for real):");
    const cap = Math.min(cands.length, 18);
    for (let i = 0; i < cap; i++) {
      const c = cands[i]!;
      const parts = [
        `"${c.title}"`,
        `type=${c.type}`,
        c.distanceKm != null && Number.isFinite(c.distanceKm)
          ? `dist_km≈${Number(c.distanceKm).toFixed(1)}`
          : null,
        c.discountedPrice != null && Number.isFinite(Number(c.discountedPrice))
          ? `discounted_price=${c.discountedPrice}`
          : null,
        c.originalPrice != null && Number.isFinite(Number(c.originalPrice))
          ? `original_price=${c.originalPrice}`
          : null,
        c.expiresAt ? `expires=${c.expiresAt}` : null,
        c.source ? `source=${c.source}` : null,
      ].filter(Boolean);
      ctxLines.push(`- ${parts.join(", ")}`);
    }
  }

  const contextBlock =
    ctxLines.length > 0 ? `Context:\n${ctxLines.join("\n")}\n\n` : "";

  return `${contextBlock}Surplus-food marketplace assistant. Reply with ONLY JSON (no markdown):
{
  "need_type": "food | financial | emotional | none",
  "urgency": "low | medium | high",
  "confidence": number,
  "search_intent": {
    "keywords": string[],
    "priority_types": string[],
    "user_preference": string | null,
    "cuisine_preference": string | null,
    "free_food_preferred": boolean,
    "cheap_food_preferred": boolean,
    "nearby_required": boolean
  },
  "ranking_hints": {
    "prioritize_distance": boolean,
    "prioritize_low_price": boolean,
    "prioritize_soon_expiring": boolean,
    "prioritize_free_food": boolean
  },
  "ui_content": { "message": string, "summary": string },
  "storage_tags": {
    "category": string | null,
    "priority_score": number | null,
    "request_label": string | null,
    "preference_text": string | null
  },
  "reasoning_summary": string
}
priority_types must be drawn from: food_bank, community_kitchen, restaurant, fast_food, bakery, cafe, grocery, supermarket (subset only).
Infer from text: urgency clues ("today", "now", "starving", "no money"), time-sensitive listings (soon expiring), distance sensitivity ("walking", "near me", "close"), cuisine ("Indian", "halal", "vegan"), free vs cheap vs discounted surplus.
Set ranking_hints when clear: urgent/nearby → prioritize_distance; budget → prioritize_low_price; pantry/free → prioritize_free_food; day-old / closing / expires → prioritize_soon_expiring. If user insists on walking distance, set nearby_required true.
Keep ui_content to short, helpful sentences. reasoning_summary: one clear sentence.

User message:
${trimmed}`;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function normalizeIntakeAnalysis(
  parsed: unknown,
  source: ClassificationSource,
  hfLabels: HfClassificationResult | null
): IntakeAiAnalysis | null {
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

  const defSi = defaultSearchIntent();
  const si =
    o.search_intent && typeof o.search_intent === "object" && !Array.isArray(o.search_intent)
      ? (o.search_intent as Record<string, unknown>)
      : null;
  const keywords = si && isStringArray(si.keywords) ? si.keywords : defSi.keywords;
  const priorityTypes =
    si && isStringArray(si.priority_types) ? si.priority_types : defSi.priority_types;
  const userPref =
    si && typeof si.user_preference === "string"
      ? si.user_preference
      : si && si.user_preference === null
        ? null
        : null;
  const cuisinePref =
    si && typeof si.cuisine_preference === "string"
      ? si.cuisine_preference.trim() || null
      : si && si.cuisine_preference === null
        ? null
        : null;
  const freePref = si && typeof si.free_food_preferred === "boolean" ? si.free_food_preferred : false;
  const cheapPref = si && typeof si.cheap_food_preferred === "boolean" ? si.cheap_food_preferred : false;
  const nearbyReq = si && typeof si.nearby_required === "boolean" ? si.nearby_required : false;

  const rh =
    o.ranking_hints && typeof o.ranking_hints === "object" && !Array.isArray(o.ranking_hints)
      ? (o.ranking_hints as Record<string, unknown>)
      : null;
  const defRh = defaultRankingHints();
  const ranking_hints: RankingHints = {
    prioritize_distance:
      rh && typeof rh.prioritize_distance === "boolean" ? rh.prioritize_distance : defRh.prioritize_distance,
    prioritize_low_price:
      rh && typeof rh.prioritize_low_price === "boolean" ? rh.prioritize_low_price : defRh.prioritize_low_price,
    prioritize_soon_expiring:
      rh && typeof rh.prioritize_soon_expiring === "boolean"
        ? rh.prioritize_soon_expiring
        : defRh.prioritize_soon_expiring,
    prioritize_free_food:
      rh && typeof rh.prioritize_free_food === "boolean"
        ? rh.prioritize_free_food
        : defRh.prioritize_free_food,
  };

  const ui =
    o.ui_content && typeof o.ui_content === "object" && !Array.isArray(o.ui_content)
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

  const st =
    o.storage_tags && typeof o.storage_tags === "object" && !Array.isArray(o.storage_tags)
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

  const reasoning_summary =
    typeof o.reasoning_summary === "string" && o.reasoning_summary.trim()
      ? o.reasoning_summary.trim()
      : "Intent parsed from user message.";

  return {
    need_type,
    urgency,
    confidence: c,
    source,
    hf_labels: hfLabels,
    search_intent: {
      keywords,
      priority_types: priorityTypes,
      user_preference: userPref,
      cuisine_preference: cuisinePref,
      free_food_preferred: freePref,
      cheap_food_preferred: cheapPref,
      nearby_required: nearbyReq,
    },
    ranking_hints,
    ui_content: { message: msg, summary: sum },
    storage_tags: {
      category,
      priority_score: priorityScore,
      request_label: requestLabel,
      preference_text: prefText,
    },
    reasoning_summary,
  };
}

/**
 * Null only when the OpenAI API call fails or returns empty content (enables Bedrock fallback).
 * Unparseable text still returns the legacy safe tuple with source `openai` (unchanged behavior).
 */
async function tryBasicOpenAIClassification(rawText: string): Promise<NeedClassification | null> {
  const trimmed = rawText.trim();
  const userPrompt = buildOpenAIClassificationPrompt(trimmed);
  try {
    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.2,
      max_tokens: 256,
      messages: [{ role: "user", content: userPrompt }],
    });
    const rawTextOut = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!rawTextOut.trim()) {
      return null;
    }
    try {
      const parsed = parseClassificationFromModelOutput(rawTextOut, "openai", "OpenAI classify");
      return { need_type: parsed.need_type, urgency: parsed.urgency, confidence: parsed.confidence };
    } catch {
      return { need_type: "none", urgency: "low", confidence: 0.5 };
    }
  } catch {
    return null;
  }
}

/**
 * Full hybrid analysis: Hugging Face (optional) + OpenAI (primary), merged safely.
 */
function shouldBedrockCompareIntake(): boolean {
  if (!isBedrockConfigured()) return false;
  const v = process.env.BEDROCK_COMPARE_INTAKE?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function appendBedrockCrossCheck(
  analysis: IntakeAiAnalysis,
  bedrock: Awaited<ReturnType<typeof classifyWithBedrock>>
): IntakeAiAnalysis {
  if (!bedrock || isBedrockUnavailable(bedrock)) return analysis;
  if (bedrock.need_type === analysis.need_type) return analysis;
  const note =
    bedrock.reasoning?.trim() ||
    `Bedrock suggests ${bedrock.need_type} (confidence ${bedrock.confidence.toFixed(2)}).`;
  const merged = `${analysis.reasoning_summary} Cross-check (Bedrock): ${note}`;
  return { ...analysis, reasoning_summary: merged.slice(0, 1200) };
}

function logAiOutcome(
  path: "rich" | "basic" | "bedrock-rich" | "bedrock-basic" | "hf" | "fallback",
  input: AnalyzeNeedInput,
  result: IntakeAiAnalysis
): void {
  const n = input.nearbyCandidates?.length ?? 0;
  const hf = result.hf_labels;
  console.log("[ai] outcome", path, {
    candidates_to_ai: n,
    role: input.role ?? null,
    need_type: result.need_type,
    urgency: result.urgency,
    source: result.source,
    hf_top: hf?.top_label ?? null,
    hf_scores: hf?.scores ?? null,
    ranking_hints: result.ranking_hints,
    search_intent: {
      cheap: result.search_intent.cheap_food_preferred,
      free: result.search_intent.free_food_preferred,
      nearby: result.search_intent.nearby_required,
      cuisine: result.search_intent.cuisine_preference,
    },
  });
  console.log(
    "[ai] merged_summary:",
    result.reasoning_summary.slice(0, 220) + (result.reasoning_summary.length > 220 ? "…" : "")
  );
}

function logHfOnly(hf: HfClassificationResult | null): void {
  if (hf) {
    console.log("[ai] hf_result:", JSON.stringify({ top_label: hf.top_label, scores: hf.scores }));
  } else {
    console.log("[ai] hf_result: null (skipped, unconfigured, or failed)");
  }
}

export async function analyzeNeedWithContext(input: AnalyzeNeedInput): Promise<IntakeAiAnalysis> {
  const trimmed = input.rawText.trim();
  if (!trimmed) {
    throw new Error("rawText must be non-empty");
  }

  const userPrompt = buildAnalyzeNeedUserPrompt(input);

  const runBedrockCompare = shouldBedrockCompareIntake();

  const bedrockComparePromise = runBedrockCompare
    ? classifyWithBedrock({ rawText: trimmed })
    : Promise.resolve(null);

  /**
   * Provider order: (1) OpenAI rich → OpenAI basic, (2) Hugging Face if OpenAI did not yield
   * a usable analysis, (3) Bedrock if both failed, (4) static safe fallback if Bedrock fails.
   * HF is loaded lazily so we only call it when merging with OpenAI or when OpenAI is exhausted.
   */
  let hfLabels: HfClassificationResult | null = null;
  const ensureHfLabels = async (): Promise<HfClassificationResult | null> => {
    if (hfLabels === null) {
      hfLabels = await classifyWithHF(trimmed);
    }
    return hfLabels;
  };

  let richRaw = "";
  try {
    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.2,
      max_tokens: 1400,
      messages: [
        { role: "system", content: STRICT_JSON_SYSTEM },
        { role: "user", content: userPrompt },
      ],
    });
    richRaw = completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    logError("[ai] analyzeNeedWithContext (OpenAI rich)", err);
    richRaw = "";
  }

  if (richRaw) {
    try {
      const jsonStr = extractJsonObjectString(richRaw);
      if (jsonStr) {
        const parsed: unknown = JSON.parse(jsonStr);
        console.log(
          "[ai] openai_parsed_keys:",
          parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? Object.keys(parsed as object).join(",")
            : "(invalid)"
        );
        const normalized = normalizeIntakeAnalysis(parsed, "openai", await ensureHfLabels());
        if (normalized) {
          logHfOpenAiDisagreement(hfLabels, normalized.need_type);
          const bedrockCompareRaw = await bedrockComparePromise;
          const withCross = appendBedrockCrossCheck(normalized, bedrockCompareRaw);
          logAiOutcome("rich", input, withCross);
          return withCross;
        }
      }
    } catch (err) {
      logError("[ai] analyzeNeedWithContext (parse rich)", err);
    }
  }

  try {
    const basic = await tryBasicOpenAIClassification(trimmed);
    if (basic) {
      await ensureHfLabels();
      const merged = intakeAnalysisFromBasic(basic, "openai", hfLabels);
      logHfOpenAiDisagreement(hfLabels, merged.need_type);
      const bedrockCompareRaw = await bedrockComparePromise;
      const withCross = appendBedrockCrossCheck(merged, bedrockCompareRaw);
      logAiOutcome("basic", input, withCross);
      return withCross;
    }
  } catch (err) {
    logError("[ai] analyzeNeedWithContext (basic OpenAI)", err);
  }

  await ensureHfLabels();
  logHfOnly(hfLabels);

  if (hfLabels) {
    const fromHf = intakeAnalysisFromHfHelper(hfLabels);
    logAiOutcome("hf", input, fromHf);
    return fromHf;
  }

  if (isBedrockConfigured()) {
    try {
      const richBedrockRaw = await invokeBedrockUserPrompt(userPrompt);
      if (!isBedrockUnavailable(richBedrockRaw) && richBedrockRaw) {
        try {
          const jsonStr = extractJsonObjectString(richBedrockRaw);
          if (jsonStr) {
            const parsed: unknown = JSON.parse(jsonStr);
            const normalized = normalizeIntakeAnalysis(parsed, "bedrock", hfLabels);
            if (normalized) {
              logHfOpenAiDisagreement(hfLabels, normalized.need_type);
              logAiOutcome("bedrock-rich", input, normalized);
              return normalized;
            }
          }
        } catch (err) {
          logError("[ai] analyzeNeedWithContext (parse bedrock rich)", err);
        }
      }

      const br = await classifyWithBedrock({ rawText: trimmed });
      if (!isBedrockUnavailable(br) && br) {
        const reasoning =
          br.reasoning?.trim() ||
          "Amazon Bedrock classifier (OpenAI unavailable; rich JSON not returned).";
        const merged = intakeAnalysisFromBasic(
          {
            need_type: br.need_type,
            urgency: br.urgency,
            confidence: br.confidence,
          },
          "bedrock",
          hfLabels,
          reasoning
        );
        logHfOpenAiDisagreement(hfLabels, merged.need_type);
        logAiOutcome("bedrock-basic", input, merged);
        return merged;
      }
    } catch (err) {
      logError("[ai] analyzeNeedWithContext (Bedrock)", err);
    }
  }

  const fallback = fullFallbackAnalysis(null);
  logAiOutcome("fallback", input, fallback);
  return fallback;
}

export async function analyzeNeed(input: AnalyzeNeedInput): Promise<IntakeAiAnalysis> {
  return analyzeNeedWithContext(input);
}

/**
 * Back-compat: text-only analysis (no nearby context).
 */
export async function analyzeIntakeNeed(rawText: string): Promise<IntakeAiAnalysis> {
  return analyzeNeedWithContext({ rawText });
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
