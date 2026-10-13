-- Private registry health, description coverage and exact publisher scope.
alter table public.raven_studio_sources
 add column if not exists consecutive_failures integer not null default 0 check(consecutive_failures >= 0),
 add column if not exists health_status text not null default 'pending' check(health_status in ('pending','healthy','degraded','failing','broken')),
 add column if not exists detail_health_status text not null default 'not_checked' check(detail_health_status in ('not_checked','complete','partial','failed','not_needed')),
 add column if not exists detail_error text,
 add column if not exists job_scope jsonb,
 add column if not exists verification_status text not null default 'pending' check(verification_status in ('pending','verified','unsupported','blocked')),
 add column if not exists verification_note text,
 add column if not exists source_verified_at timestamptz;
alter table public.raven_studio_sources add constraint raven_studio_scope_shape check(
 job_scope is null or (
 jsonb_typeof(job_scope)='object' and job_scope ?& array['field','values'] and job_scope->>'field' in ('department','company','title','organization')
 and jsonb_typeof(job_scope->'values')='array' and jsonb_array_length(job_scope->'values') between 1 and 20
 ));
alter table public.raven_studio_sources drop constraint if exists raven_studio_sources_provider_check;
alter table public.raven_studio_sources add constraint raven_studio_sources_provider_check
 check(provider in ('pending','ashby','greenhouse','lever','workable','smartrecruiters','bamboohr'));
alter table public.raven_studio_checks
 add column if not exists detail_attempted integer not null default 0,
 add column if not exists detail_completed integer not null default 0,
 add column if not exists detail_deferred integer not null default 0,
 add column if not exists detail_error text;
update public.raven_studio_sources set health_status=case when last_status='ok' then 'healthy' when last_status='failed' then 'failing' else 'pending' end,
 consecutive_failures=case when last_status='failed' then 1 else 0 end;

update public.raven_studio_sources set verification_status='verified' where provider <> 'pending';

-- Description freshness applies to discovered results, never saved documents.
alter table public.raven_search_results add column if not exists studio_description_updated_at timestamptz;
