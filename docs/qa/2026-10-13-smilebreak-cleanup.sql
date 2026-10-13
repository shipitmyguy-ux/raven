-- Reversible cleanup of a verified board mirror. Never delete either row or
-- change the original application, documents, submitted snapshots or events.
begin;
with archived as (
  update public.raven_jobs mirror
  set status='Ignored',last_updated=now()
  where mirror.id='JT-1791922237779'
    and mirror.url='https://www.artstation.com/jobs/QKn9'
    and mirror.status in ('Saved','Ignored')
    and coalesce(mirror.resume,'')='' and coalesce(mirror.cover_letter,'')=''
    and mirror.applied_date is null
    and exists (
      select 1 from public.raven_jobs original
      where original.id='BM-da3fe3e8-1909-40fa-b720-9145d995bb18'
        and original.url='https://remotegamejobs.com/jobs/smile-break-senior-environment-artist-remote-job'
        and original.status='Applied'
    )
  returning id
)
insert into public.raven_job_events(job_id,event_type,source,summary,metadata)
select 'BM-da3fe3e8-1909-40fa-b720-9145d995bb18','note','raven-dedup',
  'Verified ArtStation mirror archived; original application and documents preserved.',
  jsonb_build_object('duplicate_job_id',id,'duplicate_url','https://www.artstation.com/jobs/QKn9',
    'canonical_application_url','https://www.useparallel.com/smilebreak/careers/6ab429f63bd186aa38742a13')
from archived where not exists (
  select 1 from public.raven_job_events where source='raven-dedup'
    and metadata->>'duplicate_job_id'='JT-1791922237779'
);
commit;
