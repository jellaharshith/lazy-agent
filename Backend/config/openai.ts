import dotenv from "dotenv";
import path from "path";
import OpenAI from "openai";

dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

const key = process.env.OPENAI_API_KEY?.trim();
if (!key) {
  throw new Error(
    "OPENAI_API_KEY is missing; set it in your environment or .env file."
  );
}

export const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
