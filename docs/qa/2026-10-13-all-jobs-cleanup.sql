-- Preserve every saved job, document and submitted application record.
begin;
update public.raven_jobs j
set remote=true,last_updated=now()
where id='JT-1791413319517'
  and url='https://www.linkedin.com/jobs/view/principal-environment-artist-at-mob-entertainment-4474473548'
  and status='Applied' and remote=false
  and exists(select 1 from public.raven_search_results s
    where s.url='https://hitmarker.net/jobs/mob-entertainment-principal-environment-artist-5151006'
      and s.company='Mob Entertainment' and s.title='Principal Environment Artist'
      and s.remote=true and length(s.snippet)>6000);

insert into public.raven_job_events(job_id,event_type,source,summary,metadata)
select j.id,'note','raven-dedup-audit',p.summary,p.metadata
from (values
 ('JT-GH-EHG-8501085002','LinkedIn and Remote Game Jobs copies verified as the same vacancy. All application records and document versions preserved.',
  '{"audit":"all-jobs-2026-10-13","canonical_application_url":"https://job-boards.greenhouse.io/eleventhhourgames/jobs/8501085002","related_job_ids":["JT-1789708688405","JT-1791864981400"]}'::jsonb),
 ('JT-1791413319517','Hitmarker repost matched to this applied vacancy. Verified remote metadata restored; application and documents preserved.',
  '{"audit":"all-jobs-2026-10-13","canonical_application_url":"https://job-boards.greenhouse.io/mobentertainment/jobs/5259693007","related_listing":"https://hitmarker.net/jobs/mob-entertainment-principal-environment-artist-5151006"}'::jsonb)
) as p(job_id,summary,metadata)
join public.raven_jobs j on j.id=p.job_id and j.status='Applied'
where not exists(select 1 from public.raven_job_events e where e.job_id=j.id
  and e.source='raven-dedup-audit' and e.metadata->>'audit'='all-jobs-2026-10-13');
commit;
