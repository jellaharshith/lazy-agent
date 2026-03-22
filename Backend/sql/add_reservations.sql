-- Seeker reservations for marketplace resources
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  resource_id uuid not null references public.resources (id) on delete cascade,
  phone_number text,
  status text not null default 'reserved',
  created_at timestamptz not null default now()
);

create index if not exists idx_reservations_user_id on public.reservations (user_id);
create index if not exists idx_reservations_resource_id on public.reservations (resource_id);

alter table public.reservations enable row level security;

create policy "reservations_select_own"
  on public.reservations
  for select
  using (auth.uid() = user_id);

create policy "reservations_insert_own"
  on public.reservations
  for insert
  with check (auth.uid() = user_id);

create policy "reservations_update_own"
  on public.reservations
  for update
  using (auth.uid() = user_id);
