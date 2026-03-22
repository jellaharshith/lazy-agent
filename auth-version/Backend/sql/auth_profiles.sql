-- Auth-linked user profiles (run in Supabase SQL editor)
-- Approach: NO database trigger — the Next.js app inserts into `profiles` immediately
-- after `supabase.auth.signUp` when a session exists (email confirmation disabled or
-- user already confirmed). This keeps role + full_name in application code and avoids
-- trigger complexity with `auth.users` metadata.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null check (role in ('seeker', 'provider')),
  created_at timestamptz default now()
);

create index if not exists idx_profiles_role on public.profiles (role);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles
  for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id);
