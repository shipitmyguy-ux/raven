-- Pending near-duplicate employer openings, never a destructive merge.
-- No personal application, resume or credential data is stored here.
create table if not exists public.raven_job_duplicate_reviews (
 id uuid primary key default gen_random_uuid(),
 track text not null default 'Games / 3D',
 candidate_url text not null,
 existing_url text not null,
 candidate_source text not null,
 candidate_title text not null,
 candidate_company text not null,
 candidate_location text,
 reason text not null check (reason in ('shared-application-url','same-employer-title-and-compatible-scope','near-identical-description')),
 similarity double precision check (similarity is null or (similarity between 0 and 1)),
 status text not null default 'pending' check (status in ('pending','confirmed_duplicate','distinct','deferred')),
 first_seen timestamptz not null default now(),
 last_seen timestamptz not null default now(),
 unique(candidate_url,existing_url)
);
create index if not exists raven_job_duplicate_reviews_status_idx
 on public.raven_job_duplicate_reviews (status,first_seen desc);
alter table public.raven_job_duplicate_reviews enable row level security;
revoke all on table public.raven_job_duplicate_reviews from public,anon,authenticated;
grant select,insert,update on table public.raven_job_duplicate_reviews to service_role;
-- Do not add anonymous/authenticated policies or a public read endpoint.
