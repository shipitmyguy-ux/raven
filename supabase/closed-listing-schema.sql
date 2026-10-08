-- Additive prerequisite for closed-listing checks. Existing RLS/grants stay in force.
alter table public.raven_jobs add column if not exists listing_check jsonb;
alter table public.raven_search_results add column if not exists listing_check jsonb;
comment on column public.raven_jobs.listing_check is 'Source availability evidence, independent of application lifecycle';
comment on column public.raven_search_results.listing_check is 'Source availability evidence; retained across search refreshes';
