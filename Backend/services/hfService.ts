import { HF_API_KEY, HF_ZERO_SHOT_MODEL, isHfConfigured } from "../config/huggingface";

const HF_LABELS = ["food", "financial", "emotional", "none"] as const;

export type HfNeedLabel = (typeof HF_LABELS)[number];

export type HfClassificationResult = {
  top_label: string;
  scores: Record<HfNeedLabel, number>;
};

const INFERENCE_URL = (model: string) =>
  `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`;

function emptyScores(): Record<HfNeedLabel, number> {
  return { food: 0, financial: 0, emotional: 0, none: 0 };
}

function normalizeScoresFromPairs(
  labels: string[],
  scores: number[]
): Record<HfNeedLabel, number> {
  const out = emptyScores();
  const n = Math.min(labels.length, scores.length);
  for (let i = 0; i < n; i++) {
    const lab = String(labels[i] ?? "").toLowerCase().trim();
    const s = typeof scores[i] === "number" ? scores[i] : Number(scores[i]);
    if (!Number.isFinite(s)) continue;
    if (lab === "food" || lab === "financial" || lab === "emotional" || lab === "none") {
      out[lab] = Math.max(0, Math.min(1, s));
    }
  }
  const sum = HF_LABELS.reduce((a, k) => a + out[k], 0);
  if (sum > 0 && sum < 0.999) {
    for (const k of HF_LABELS) {
      out[k] = out[k] / sum;
    }
  }
  return out;
}

function parseHfPayload(data: unknown): HfClassificationResult | null {
  if (data == null) return null;

  if (Array.isArray(data)) {
    const first = data[0];
    // Common shape: [[{label, score}, ...]]
    if (Array.isArray(first) && first.length > 0) {
      const labels: string[] = [];
      const scores: number[] = [];
      for (const row of first) {
        if (row && typeof row === "object" && !Array.isArray(row)) {
          const o = row as Record<string, unknown>;
          if (typeof o.label === "string" && typeof o.score === "number") {
            labels.push(o.label);
            scores.push(o.score);
          }
        }
      }
      if (labels.length > 0) {
        const norm = normalizeScoresFromPairs(labels, scores);
        const top = HF_LABELS.reduce((a, k) => (norm[k] > norm[a] ? k : a), "none");
        return { top_label: top, scores: norm };
      }
    }
    if (first && typeof first === "object" && !Array.isArray(first)) {
      const o = first as Record<string, unknown>;
      if (Array.isArray(o.labels) && Array.isArray(o.scores)) {
        const scores = normalizeScoresFromPairs(
          o.labels as string[],
          o.scores as number[]
        );
        const top = HF_LABELS.reduce((a, k) => (scores[k] > scores[a] ? k : a), "none");
        return { top_label: top, scores };
      }
    }
    if (typeof data[0] === "object" && data[0] !== null) {
      const row = data[0] as Record<string, unknown>;
      if (typeof row.label === "string" && typeof row.score === "number") {
        const scores = emptyScores();
        const lab = row.label.toLowerCase().trim();
        if (lab in scores) {
          scores[lab as HfNeedLabel] = Math.max(0, Math.min(1, row.score));
        }
        const top = HF_LABELS.reduce((a, k) => (scores[k] > scores[a] ? k : a), "none");
        return { top_label: top, scores };
      }
    }
  }

  if (typeof data === "object" && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.labels) && Array.isArray(o.scores)) {
      const scores = normalizeScoresFromPairs(o.labels as string[], o.scores as number[]);
      const top = HF_LABELS.reduce((a, k) => (scores[k] > scores[a] ? k : a), "none");
      return { top_label: top, scores };
    }
  }

  return null;
}

/**
 * Zero-shot classification via Hugging Face Inference API.
 * Returns null if unconfigured, HTTP error, or unparseable response (intake continues).
 */
export async function classifyWithHF(text: string): Promise<HfClassificationResult | null> {
  if (!isHfConfigured()) {
    return null;
  }

  const trimmed = text.trim().slice(0, 2000);
  if (!trimmed) {
    return null;
  }

  const model = HF_ZERO_SHOT_MODEL;

  try {
    const res = await fetch(INFERENCE_URL(model), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: trimmed,
        parameters: { candidate_labels: [...HF_LABELS] },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.warn(
        "[hf] classifyWithHF HTTP",
        res.status,
        errBody.slice(0, 200)
      );
      return null;
    }

    const data: unknown = await res.json().catch(() => null);
    const parsed = parseHfPayload(data);
    if (!parsed) {
      console.warn("[hf] classifyWithHF: unparseable response shape");
      return null;
    }

    return parsed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[hf] classifyWithHF failed:", msg);
    return null;
  }
}
