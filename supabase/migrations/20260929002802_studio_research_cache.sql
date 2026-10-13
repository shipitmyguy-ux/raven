create table if not exists public.raven_studio_context_cache (
  studio_key text primary key,
  profile jsonb not null check (jsonb_typeof(profile) = 'object'),
  expires_at timestamptz not null
);
alter table public.raven_studio_context_cache enable row level security;
revoke all on public.raven_studio_context_cache from public, anon, authenticated;
grant select, insert, update, delete on public.raven_studio_context_cache to service_role;
comment on table public.raven_studio_context_cache is 'Server-only cache of bounded official studio page excerpts. Never candidate qualifications.';
