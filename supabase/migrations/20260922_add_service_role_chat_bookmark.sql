create or replace function public.raven_chat_bookmark(p_job jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
begin
  select key_hash into k
  from public.raven_bookmark_keys
  where label='ChatGPT Raven Bookmarks 2026-09-21'
    and revoked_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;
  if k is null then
    return jsonb_build_object('error','Chat bookmark key unavailable.','status',503);
  end if;
  return public.raven_save_bookmark(k,p_job);
end;
$$;

revoke all on function public.raven_chat_bookmark(jsonb) from public, anon, authenticated;
grant execute on function public.raven_chat_bookmark(jsonb) to service_role;
