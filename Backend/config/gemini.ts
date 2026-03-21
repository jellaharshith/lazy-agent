import dotenv from "dotenv";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

const key = process.env.GEMINI_API_KEY?.trim();
if (!key) {
  throw new Error(
    "GEMINI_API_KEY is missing; set it in your environment or .env file."
  );
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
export const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

console.log("[gemini] Gemini model initialized: gemini-1.5-flash");
