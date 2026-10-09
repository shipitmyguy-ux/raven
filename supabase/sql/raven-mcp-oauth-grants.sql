-- Private single-owner grants. Runtime account/client IDs are provisioned separately.
create table public.raven_mcp_owner (
 singleton boolean primary key default true check (singleton),
 subject uuid not null unique references auth.users(id)
);
create table public.raven_mcp_oauth_grants (
 client_id uuid primary key references auth.oauth_clients(id),
 subject uuid not null references public.raven_mcp_owner(subject),
 job_ids text[] not null check (cardinality(job_ids) between 1 and 200),
 scopes text[] not null check (cardinality(scopes)>0 and scopes <@ array['jobs:read','profile:read','documents:create','documents:revise']::text[]),
 expires_at timestamptz not null,
 revoked_at timestamptz
);
alter table public.raven_mcp_owner enable row level security;
alter table public.raven_mcp_oauth_grants enable row level security;
revoke all on public.raven_mcp_owner,public.raven_mcp_oauth_grants from public,anon,authenticated,service_role;
grant select on public.raven_mcp_owner,public.raven_mcp_oauth_grants to service_role,supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
create policy auth_hook_owner_read on public.raven_mcp_owner for select to supabase_auth_admin using (true);
create policy auth_hook_grant_read on public.raven_mcp_oauth_grants for select to supabase_auth_admin using (true);

-- Only the service-side bridge can call this; each request checks current consent/session/grant.
create function public.raven_mcp_oauth_grant(p_subject uuid,p_client_id uuid,p_session_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('subject',g.subject,'client_id',g.client_id,
  'job_ids',g.job_ids,'scopes',g.scopes,'expires_at',g.expires_at)
 from public.raven_mcp_oauth_grants g
 join public.raven_mcp_owner o on o.subject=g.subject
 join auth.oauth_clients c on c.id=g.client_id and c.deleted_at is null
 join auth.sessions s on s.id=p_session_id and s.user_id=g.subject
  and s.oauth_client_id=g.client_id and (s.not_after is null or s.not_after>now())
 where g.subject=p_subject and g.client_id=p_client_id
  and g.revoked_at is null and g.expires_at>now()
  and exists(select 1 from auth.oauth_consents co where co.user_id=g.subject
   and co.client_id=g.client_id and co.revoked_at is null)
$$;
revoke all on function public.raven_mcp_oauth_grant(uuid,uuid,uuid) from public,anon,authenticated,supabase_auth_admin;
grant execute on function public.raven_mcp_oauth_grant(uuid,uuid,uuid) to service_role;

-- Enable as Custom Access Token Hook in Auth > Hooks after provisioning the grant.
-- All other tokens keep every original claim, including their original audience.
create or replace function public.raven_mcp_access_token_hook(event jsonb)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare claims jsonb:=event->'claims'; hook_client text; hook_subject text;
begin
 hook_client:=coalesce(event->>'client_id',claims->>'client_id');
 hook_subject:=claims->>'sub';
 if claims->>'role'='authenticated' and exists (
  select 1 from public.raven_mcp_oauth_grants g
  join public.raven_mcp_owner o on o.subject=g.subject
  where g.subject::text=hook_subject and g.client_id::text=hook_client
   and g.revoked_at is null and g.expires_at>now()
 ) then
  claims:=jsonb_set(claims,'{aud}',to_jsonb('https://umvmilulnqnmeqvfoxxc.supabase.co/functions/v1/raven-mcp-v1'::text));
  event:=jsonb_set(event,'{claims}',claims);
 end if;
 return event;
end $$;
revoke all on function public.raven_mcp_access_token_hook(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.raven_mcp_access_token_hook(jsonb) to supabase_auth_admin;
