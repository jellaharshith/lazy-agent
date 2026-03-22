-- Marketplace columns for surplus listings (idempotent)
alter table public.resources add column if not exists category text;
alter table public.resources add column if not exists original_price numeric;
alter table public.resources add column if not exists discounted_price numeric;
