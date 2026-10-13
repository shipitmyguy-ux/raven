-- Extend the private studio registry for verified public ATS APIs.
alter table public.raven_studio_sources drop constraint if exists raven_studio_sources_provider_check;
alter table public.raven_studio_sources add constraint raven_studio_sources_provider_check
 check (provider in ('pending','ashby','greenhouse','lever','workable','smartrecruiters'));
