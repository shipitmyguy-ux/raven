-- Availability is independent of saved application lifecycle and documents.
alter table public.raven_jobs add column if not exists listing_state text;
alter table public.raven_jobs add column if not exists listing_reason text;
alter table public.raven_jobs add column if not exists listing_checked_at timestamptz;
alter table public.raven_jobs add column if not exists listing_source_url text;
alter table public.raven_jobs add column if not exists listing_http_status integer;
alter table public.raven_search_results add column if not exists listing_state text;
alter table public.raven_search_results add column if not exists listing_reason text;
alter table public.raven_search_results add column if not exists listing_checked_at timestamptz;
alter table public.raven_search_results add column if not exists listing_source_url text;
alter table public.raven_search_results add column if not exists listing_http_status integer;

-- Search ingestion cannot resurrect a confirmed closed row or erase evidence.
create or replace function public.preserve_confirmed_listing_closure() returns trigger
language plpgsql set search_path=public as $$
begin
 if old.listing_state='closed' then
  new.listing_state=old.listing_state;
  new.listing_reason=old.listing_reason;
  new.listing_checked_at=old.listing_checked_at;
  new.listing_source_url=old.listing_source_url;
  new.listing_http_status=old.listing_http_status;
  new.status='Expired';
 end if;
 return new;
end;
$$;
drop trigger if exists preserve_confirmed_listing_closure on public.raven_search_results;
create trigger preserve_confirmed_listing_closure before update on public.raven_search_results
for each row execute function public.preserve_confirmed_listing_closure();
