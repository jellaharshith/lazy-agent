-- Intent Commons schema
-- Assumes pgcrypto extension is available for gen_random_uuid()

create extension if not exists pgcrypto;

create table if not exists needs (
  id uuid primary key default gen_random_uuid(),
  raw_text text not null,
  need_type text not null,
  urgency text not null,
  confidence numeric,
  lat double precision,
  lng double precision,
  status text default 'open',
  created_at timestamp with time zone default now()
);

create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  resource_type text default 'food',
  quantity integer,
  expires_at timestamp with time zone,
  lat double precision,
  lng double precision,
  status text default 'available',
  created_at timestamp with time zone default now()
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  need_id uuid references needs(id) on delete cascade,
  resource_id uuid references resources(id) on delete cascade,
  score numeric,
  distance_km numeric,
  status text default 'suggested',
  created_at timestamp with time zone default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  need_id uuid references needs(id) on delete cascade,
  message_text text,
  voice_url text,
  created_at timestamp with time zone default now()
);

create index if not exists idx_needs_status on needs(status);
create index if not exists idx_resources_status on resources(status);
create index if not exists idx_resources_expires_at on resources(expires_at);
create index if not exists idx_matches_need_id on matches(need_id);
create index if not exists idx_matches_resource_id on matches(resource_id);
