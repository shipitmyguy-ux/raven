-- Separate individual studios from broad hiring boards, with sourced indie labels.
alter table public.raven_studio_sources
 add column if not exists source_kind text not null default 'studio' check(source_kind in ('studio','job_board')),
 add column if not exists segment text not null default 'unknown' check(segment in ('indie','indie_origin','boutique','major','unknown')),
 add column if not exists segment_note text;
alter table public.raven_studio_sources drop constraint if exists raven_studio_sources_provider_check;
alter table public.raven_studio_sources add constraint raven_studio_sources_provider_check
 check(provider in ('pending','ashby','greenhouse','lever','workable','smartrecruiters','bamboohr','icims','avature','jobylon','workwithindies','teamtailor'));
