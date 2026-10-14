-- Single-owner local writer transport. No public or authenticated Data API access.
create table public.raven_local_workers (
 id uuid primary key,
 last_seen timestamptz not null default now()
);
create table public.raven_local_devices (
 id uuid primary key,
 worker_id uuid not null references public.raven_local_workers(id),
 token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null,
 revoked boolean not null default false
);
create table public.raven_local_queue (
 run_id uuid primary key default gen_random_uuid(),
 worker_id uuid not null references public.raven_local_workers(id),
 device_id uuid not null references public.raven_local_devices(id),
 job_id text not null,
 document_type text not null check (document_type in ('resume','coverLetter','both')),
 stage text not null default 'queued' check (stage in ('queued','running','complete','failed')),
 created_at timestamptz not null default now(),
 error text,
 documents jsonb not null default '[]'::jsonb
);
create index raven_local_queue_pending on public.raven_local_queue(worker_id,created_at) where stage in ('queued','running');
create index raven_local_queue_device on public.raven_local_queue(device_id);
create index raven_local_devices_worker on public.raven_local_devices(worker_id);
alter table public.raven_local_workers enable row level security;
alter table public.raven_local_devices enable row level security;
alter table public.raven_local_queue enable row level security;
revoke all on public.raven_local_workers, public.raven_local_devices, public.raven_local_queue from public, anon, authenticated;
grant all on public.raven_local_workers, public.raven_local_devices, public.raven_local_queue to service_role;
create function public.raven_enqueue_local(p_device uuid,p_job text,p_kind text)
returns setof public.raven_local_queue
language plpgsql security invoker set search_path = '' as $$
declare d public.raven_local_devices; existing public.raven_local_queue;
begin
 select * into d from public.raven_local_devices where id=p_device and not revoked and expires_at>now();
 if not found or p_kind not in ('resume','coverLetter','both') then return; end if;
 -- Serialize per computer to bound pending work even across concurrent devices.
 perform 1 from public.raven_local_workers where id=d.worker_id for update;
 if not exists(select 1 from public.raven_jobs where id=p_job) then return; end if;
 select * into existing from public.raven_local_queue where device_id=d.id and job_id=p_job and document_type=p_kind and stage in ('queued','running') order by created_at limit 1;
 if found then return next existing; return; end if;
 if (select count(*) from public.raven_local_queue where worker_id=d.worker_id and stage in ('queued','running'))>=20 then return; end if;
 return query insert into public.raven_local_queue(worker_id,device_id,job_id,document_type) values(d.worker_id,d.id,p_job,p_kind) returning *;
end;
$$;
revoke all on function public.raven_enqueue_local(uuid,text,text) from public, anon, authenticated;
grant execute on function public.raven_enqueue_local(uuid,text,text) to service_role;
