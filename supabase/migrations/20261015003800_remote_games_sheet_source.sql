-- Add the validated public remote-games spreadsheet to Raven's existing authenticated studio scheduler.
-- This source is a third-party job lead feed, not an independently verified careers page.
-- Its fixed Google export URL is hardcoded and checked by studio-sheet-feed.mjs.
alter table public.raven_studio_sources drop constraint if exists raven_studio_sources_provider_check;
alter table public.raven_studio_sources add constraint raven_studio_sources_provider_check
 check(provider in ('pending','ashby','greenhouse','lever','workable','smartrecruiters','bamboohr','icims','avature','jobylon','workwithindies','teamtailor','breezy','recruitee','remotegamejobs','blenderartists','epicforum','artstation','hitmarker','eightbit','skillsearch','gamesjobsdirect','ingamejob','remotegamessheet'));
insert into public.raven_studio_sources
 (studio_name,slug,provider,board_key,careers_url,source_kind,segment,segment_note,
  verification_status,verification_note,priority,enabled,interval_hours,source_verified_at,next_check_at)
values
 ('Tim Plöger Remote Games Sheet','tim-ploeger-remote-games','remotegamessheet',
  'tim-ploeger-remote-games',
  'https://docs.google.com/spreadsheets/d/1Kue4iGy1WNpItNyCpaMT9__A_228NmbQ9s_uUcc3wb8/edit',
  'job_board','unknown','Community spreadsheet source; not an individual studio.',
  'verified','Public CSV export verified, all 656 listed rows available 2026-10-14; individual vacancies remain unverified.',
  2,true,24,now(),now()-interval '7 days')
on conflict(slug) do nothing;
