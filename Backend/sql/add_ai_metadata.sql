-- AI / preference metadata on needs (idempotent, safe to re-run)
-- Run after schema.sql; complements add_user_columns.sql for user_id.
-- If PostgREST still errors on new columns until cache refreshes, the app retries without optional fields.

alter table public.needs add column if not exists category text;
alter table public.needs add column if not exists request_label text;
alter table public.needs add column if not exists priority_score integer;
alter table public.needs add column if not exists preference_text text;

-- Link needs to auth when column is missing (skipped if already added elsewhere)
alter table public.needs
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create index if not exists idx_needs_user_id on public.needs (user_id);
