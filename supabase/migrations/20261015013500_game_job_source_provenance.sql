-- Durable source provenance for accepted discovery identities.
-- Duplicate URL sightings point to the existing canonical job, never rewrite
-- saved application IDs, statuses, resumes or cover letters.
create table if not exists public.raven_job_source_links (
 source_name text not null,
 observed_url text not null,
 canonical_url text not null,
 first_seen timestamptz not null default now(),
 last_seen timestamptz not null default now(),
 primary key(source_name,observed_url),
 constraint source_links_valid_urls check (observed_url like 'https://%' and canonical_url like 'https://%')
);
create index if not exists raven_job_source_links_canonical_idx
 on public.raven_job_source_links (canonical_url,last_seen desc);
alter table public.raven_job_source_links enable row level security;
revoke all on public.raven_job_source_links from public,anon,authenticated;
grant select,insert,update on public.raven_job_source_links to service_role;
