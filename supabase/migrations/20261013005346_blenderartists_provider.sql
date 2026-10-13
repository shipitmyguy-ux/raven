-- Community work boards remain fixed-host and category-bound in the collector.
alter table public.raven_studio_sources drop constraint if exists raven_studio_sources_provider_check;
alter table public.raven_studio_sources add constraint raven_studio_sources_provider_check
 check(provider in ('pending','ashby','greenhouse','lever','workable','smartrecruiters','bamboohr','icims','avature','jobylon','workwithindies','teamtailor','breezy','recruitee','remotegamejobs','blenderartists','epicforum','artstation'));
