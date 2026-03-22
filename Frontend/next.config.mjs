import nextEnv from "@next/env";
import path from "path";
import { fileURLToPath } from "url";

const { loadEnvConfig } = nextEnv;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

// Load repo root .env (where you keep SUPABASE_*), then Frontend/.env.local (overrides).
loadEnvConfig(repoRoot);
loadEnvConfig(__dirname);

// Browser bundle only sees NEXT_PUBLIC_* — mirror root names so one .env can drive both Backend and Frontend.
if (process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;
}
if (process.env.SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
