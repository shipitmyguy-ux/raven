-- Post-application lifecycle persistence.
-- Browser clients do not access these tables directly; raven-backend-v3 uses service_role.

create table if not exists public.raven_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id text not null references public.raven_jobs(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  source text not null default 'manual',
  summary text not null default '',
  confidence numeric null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint raven_job_events_confidence_check
    check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create index if not exists raven_job_events_job_time_idx
  on public.raven_job_events(job_id, occurred_at desc);

create index if not exists raven_job_events_type_time_idx
  on public.raven_job_events(event_type, occurred_at desc);

create table if not exists public.raven_job_snapshots (
  id uuid primary key default gen_random_uuid(),
  job_id text not null references public.raven_jobs(id) on delete cascade,
  snapshot_type text not null default 'application',
  captured_at timestamptz not null default now(),
  content_hash text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint raven_job_snapshots_unique unique(job_id, snapshot_type, content_hash)
);

create index if not exists raven_job_snapshots_job_time_idx
  on public.raven_job_snapshots(job_id, captured_at desc);

alter table public.raven_job_events enable row level security;
alter table public.raven_job_snapshots enable row level security;

revoke all on table public.raven_job_events from anon, authenticated;
revoke all on table public.raven_job_snapshots from anon, authenticated;
grant select, insert, update, delete on table public.raven_job_events to service_role;
grant select, insert, delete on table public.raven_job_snapshots to service_role;
