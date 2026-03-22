-- Provider voice alerts: add optional phone to profiles (run once).
-- Option A — Supabase SQL Editor → New query → paste this file → Run.
-- Option B — Local: set SUPABASE_DB_PASSWORD in .env (Dashboard → Settings → Database), then:
--   npm run db:apply-profile-phone
-- Existing RLS policies (profiles_update_own) already allow users to update their own row.

alter table public.profiles
  add column if not exists phone_number text;
