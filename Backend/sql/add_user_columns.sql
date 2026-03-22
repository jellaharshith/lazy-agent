-- Ownership columns for Supabase Auth (run once after schema.sql)

alter table needs add column user_id uuid references auth.users(id) on delete set null;
alter table resources add column provider_id uuid references auth.users(id) on delete set null;

create index if not exists idx_needs_user_id on needs(user_id);
create index if not exists idx_resources_provider_id on resources(provider_id);
