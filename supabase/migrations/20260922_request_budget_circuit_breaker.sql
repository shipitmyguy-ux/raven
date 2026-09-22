create table if not exists public.raven_request_events (
  id bigint generated always as identity primary key,
  kind text not null,
  scope text not null default 'global',
  status text not null default 'started',
  http_status integer,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists raven_request_events_kind_created_idx
  on public.raven_request_events(kind, created_at desc);
create index if not exists raven_request_events_kind_scope_created_idx
  on public.raven_request_events(kind, scope, created_at desc);

alter table public.raven_request_events enable row level security;
revoke all privileges on table public.raven_request_events from anon, authenticated;
grant select, insert, update, delete on table public.raven_request_events to service_role;
grant usage, select on sequence public.raven_request_events_id_seq to service_role;

create or replace function public.raven_request_guard(
  p_kind text,
  p_scope text default 'global',
  p_short_limit integer default 8,
  p_short_seconds integer default 60,
  p_long_limit integer default 40,
  p_long_seconds integer default 600,
  p_failure_threshold integer default 3,
  p_failure_window_seconds integer default 300,
  p_circuit_seconds integer default 600
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_short_count integer;
  v_long_count integer;
  v_failures integer;
  v_last_success timestamptz;
  v_latest_failure timestamptz;
  v_event_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext('raven-request-budget:' || p_kind));

  select max(created_at) into v_last_success
  from public.raven_request_events
  where kind=p_kind and scope=coalesce(nullif(p_scope,''),'global') and status='success';

  select count(*), max(created_at)
    into v_failures, v_latest_failure
  from public.raven_request_events
  where kind=p_kind
    and scope=coalesce(nullif(p_scope,''),'global')
    and status='failure'
    and created_at >= now() - make_interval(secs => greatest(1,p_failure_window_seconds))
    and (v_last_success is null or created_at > v_last_success);

  if v_failures >= greatest(1,p_failure_threshold)
     and v_latest_failure is not null
     and v_latest_failure + make_interval(secs => greatest(1,p_circuit_seconds)) > now() then
    return jsonb_build_object(
      'allowed',false,
      'reason','circuit-open',
      'retry_after_seconds',greatest(1,ceil(extract(epoch from ((v_latest_failure + make_interval(secs => greatest(1,p_circuit_seconds))) - now())))::integer)
    );
  end if;

  select count(*) into v_short_count
  from public.raven_request_events
  where kind=p_kind
    and created_at >= now() - make_interval(secs => greatest(1,p_short_seconds));

  if v_short_count >= greatest(1,p_short_limit) then
    return jsonb_build_object('allowed',false,'reason','rate-limit','window','short','retry_after_seconds',greatest(1,p_short_seconds));
  end if;

  select count(*) into v_long_count
  from public.raven_request_events
  where kind=p_kind
    and created_at >= now() - make_interval(secs => greatest(1,p_long_seconds));

  if v_long_count >= greatest(1,p_long_limit) then
    return jsonb_build_object('allowed',false,'reason','rate-limit','window','long','retry_after_seconds',greatest(1,p_long_seconds));
  end if;

  insert into public.raven_request_events(kind,scope,status)
  values (p_kind,coalesce(nullif(p_scope,''),'global'),'started')
  returning id into v_event_id;

  return jsonb_build_object(
    'allowed',true,
    'event_id',v_event_id,
    'short_remaining',greatest(0,p_short_limit-v_short_count-1),
    'long_remaining',greatest(0,p_long_limit-v_long_count-1)
  );
end;
$$;

create or replace function public.raven_request_finish(
  p_event_id bigint,
  p_status text,
  p_http_status integer default null,
  p_detail text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('success','failure') then
    raise exception 'invalid request event status';
  end if;
  update public.raven_request_events
  set status=p_status,
      http_status=p_http_status,
      detail=left(coalesce(p_detail,''),1000)
  where id=p_event_id;
end;
$$;

revoke all on function public.raven_request_guard(text,text,integer,integer,integer,integer,integer,integer,integer) from public, anon, authenticated;
revoke all on function public.raven_request_finish(bigint,text,integer,text) from public, anon, authenticated;
grant execute on function public.raven_request_guard(text,text,integer,integer,integer,integer,integer,integer,integer) to service_role;
grant execute on function public.raven_request_finish(bigint,text,integer,text) to service_role;
