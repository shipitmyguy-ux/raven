-- Service-only immutable archive and atomic compare-and-replace.
create table if not exists public.raven_document_versions (
 id uuid primary key default gen_random_uuid(),
 job_id text not null references public.raven_jobs(id),
 document_type text not null check(document_type in ('resume','coverLetter')),
 document_url text not null,
 job_version timestamptz not null,
 archived_at timestamptz not null default now()
);
alter table public.raven_document_versions enable row level security;
revoke all on public.raven_document_versions from public,anon,authenticated,service_role;
grant select,insert on public.raven_document_versions to service_role;
create or replace function public.raven_mcp_replace_document(
 p_job_id text,p_document_type text,p_expected_version timestamptz,
 p_previous_document text,p_document text,p_new_version timestamptz
) returns table(id text,last_updated timestamptz,resume text,cover_letter text)
language plpgsql security invoker set search_path='' as $$
declare prior public.raven_jobs%rowtype;
begin
 if p_document_type not in ('resume','coverLetter') or p_document is null
    or p_new_version<=p_expected_version then raise exception 'INVALID_ARGUMENTS'; end if;
 select * into prior from public.raven_jobs j where j.id=p_job_id for update;
 if not found or prior.last_updated is distinct from p_expected_version then return; end if;
 if (case when p_document_type='resume' then prior.resume else prior.cover_letter end) is distinct from p_previous_document
    or coalesce(p_previous_document,'')='' then return; end if;
 insert into public.raven_document_versions(job_id,document_type,document_url,job_version)
 values(p_job_id,p_document_type,p_previous_document,prior.last_updated);
 return query update public.raven_jobs j set
 resume=case when p_document_type='resume' then p_document else j.resume end,
 cover_letter=case when p_document_type='coverLetter' then p_document else j.cover_letter end,
 last_updated=p_new_version where j.id=p_job_id
 returning j.id,j.last_updated,j.resume,j.cover_letter;
end $$;
revoke all on function public.raven_mcp_replace_document(text,text,timestamptz,text,text,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.raven_mcp_replace_document(text,text,timestamptz,text,text,timestamptz) to service_role;
