-- User direction 2026-10-14: GMT overlap and country labels are never visa evidence.
-- Reverse only the eight prior GeoReview records from the spreadsheet cleanup.
-- Keep saved applications, private docs, original location and any independent
-- listing-availability note unchanged. Do not invent visa ineligibility.
update public.raven_search_results
set status='Discovered',
    listing_state=null,
    listing_reason=case
      when listing_reason in (
        'Source requires working within two hours of GMT+1; not compatible with Colorado.',
        'Source lists a Canada-only remote scope; not a US-remote opening.'
      ) then null
      else listing_reason
    end,
    listing_checked_at=case
      when listing_reason in (
        'Source requires working within two hours of GMT+1; not compatible with Colorado.',
        'Source lists a Canada-only remote scope; not a US-remote opening.'
      ) then null
      else listing_checked_at
    end
where source='Tim Ploeger Remote Games Sheet'
  and track='Games / 3D'
  and status='GeoReview'
  and listing_state='geo_ineligible'
  and location in ('Canada','Canada (Ontario)','Worldwide (-/+ 2h from GMT+1)');
