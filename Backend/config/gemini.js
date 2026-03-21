"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GEMINI_MODEL = void 0;
exports.getGeminiApiKey = getGeminiApiKey;
exports.geminiGenerateContentUrl = geminiGenerateContentUrl;
/** Default model for generateContent (not a secret). */
exports.GEMINI_MODEL = 'gemini-2.0-flash';
function getGeminiApiKey() {
    const key = process.env.GEMINI_API_KEY;
    if (!key || !key.trim()) {
        throw new Error('Missing required environment variable: GEMINI_API_KEY. Set it in your .env file.');
    }
    return key.trim();
}
function geminiGenerateContentUrl(apiKey) {
    const encodedKey = encodeURIComponent(apiKey);
    return `https://generativelanguage.googleapis.com/v1beta/models/${exports.GEMINI_MODEL}:generateContent?key=${encodedKey}`;
}
