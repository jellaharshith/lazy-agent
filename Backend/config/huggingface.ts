import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

/** Optional — HF is a helper; intake works without it. */
export const HF_API_KEY = process.env.HF_API_KEY?.trim() ?? "";

/** Zero-shot NLI model on Hugging Face Inference API. */
export const HF_ZERO_SHOT_MODEL =
  process.env.HF_ZERO_SHOT_MODEL?.trim() || "valhalla/distilbart-mnli-12-3";

export function isHfConfigured(): boolean {
  return HF_API_KEY.length > 0;
}
