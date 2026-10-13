-- Additional verified fixed-host studio careers adapters.
alter table public.raven_studio_sources drop constraint if exists raven_studio_sources_provider_check;
alter table public.raven_studio_sources add constraint raven_studio_sources_provider_check
 check(provider in ('pending','ashby','greenhouse','lever','workable','smartrecruiters','bamboohr','icims','avature','jobylon'));

alter table public.raven_studio_sources add column if not exists detail_cursor integer not null default 0 check(detail_cursor>=0);
