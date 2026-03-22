-- Resource marketplace columns (idempotent, safe to re-run)
-- Run in Supabase SQL editor or psql after schema.sql / seed migrations.

alter table public.resources add column if not exists category text;
alter table public.resources add column if not exists resource_type text default 'food';
alter table public.resources add column if not exists original_price numeric;
alter table public.resources add column if not exists discounted_price numeric;
alter table public.resources add column if not exists provider_id uuid;
alter table public.resources add column if not exists status text default 'available';

comment on column public.resources.provider_id is 'Optional link to listing provider (no FK by default — add if your auth schema supports it).';
