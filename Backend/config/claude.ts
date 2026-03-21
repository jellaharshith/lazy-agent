import dotenv from "dotenv";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

const apiKey = process.env.CLAUDE_API_KEY?.trim();
if (!apiKey) {
  throw new Error("CLAUDE_API_KEY is missing — set it in .env for AI fallback");
}

/** Shared Anthropic client for classification and ping. */
export const anthropicClient = new Anthropic({ apiKey });

/** Model for classify/ping (override with CLAUDE_MODEL in .env). */
export const claudeModel =
  process.env.CLAUDE_MODEL?.trim() || "claude-3-5-haiku-20241022";

console.log("Claude client initialized successfully");
