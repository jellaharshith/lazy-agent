import { createClient, SupabaseClient } from '@supabase/supabase-js';

function requireEnv(name: 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `Missing required environment variable: ${name}. Set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file.`
    );
  }
  return value.trim();
}

const supabaseUrl = requireEnv('SUPABASE_URL');
const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
