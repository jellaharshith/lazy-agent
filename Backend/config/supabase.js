"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
function requireEnv(name) {
    const value = process.env[name];
    if (!value || !value.trim()) {
        throw new Error(`Missing required environment variable: ${name}. Set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file.`);
    }
    return value.trim();
}
const supabaseUrl = requireEnv('SUPABASE_URL');
const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey);
