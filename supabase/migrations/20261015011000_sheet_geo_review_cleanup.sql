-- Remove clearly US-ineligible 2026 spreadsheet leads from discovery only.
-- Preserve saved jobs, lifecycle history and the original source evidence.
-- Canada-only and GMT+1 +/-2h cannot be fulfilled from Colorado.
do $do$
declare affected integer;
begin
 with flagged as (
  update public.raven_search_results
  set status='GeoReview',
      listing_state='geo_ineligible',
      listing_reason=case
       when location='Worldwide (-/+ 2h from GMT+1)' then 'Source requires working within two hours of GMT+1; not compatible with Colorado.'
       else 'Source lists a Canada-only remote scope; not a US-remote opening.'
      end,
      listing_checked_at=now()
  where source='Tim Ploeger Remote Games Sheet'
    and track='Games / 3D'
    and status='Discovered'
    and location in ('Canada','Canada (Ontario)','Worldwide (-/+ 2h from GMT+1)')
  returning id
 )
 select count(*) into affected from flagged;
 if affected<>8 then raise exception 'Unexpected geographic review count: % (expected 8)',affected; end if;
end $do$;
