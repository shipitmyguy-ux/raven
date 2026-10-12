-- Raven studio directory: schema and verified initial sources.
create table if not exists public.raven_studio_sources(
 id uuid primary key default gen_random_uuid(),studio_name text not null,slug text not null unique,
 provider text not null default 'pending' check(provider in ('pending','ashby','greenhouse','lever')),
 board_key text,careers_url text,priority integer not null default 1 check(priority between 1 and 3),
 enabled boolean not null default true,interval_hours integer not null default 24 check(interval_hours between 6 and 168),
 next_check_at timestamptz not null default now(),last_checked_at timestamptz,last_success_at timestamptz,
 last_status text not null default 'pending',last_error text,last_job_count integer not null default 0,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint raven_studio_provider_board check(provider='pending' or nullif(trim(board_key),'') is not null)
);
create index if not exists raven_studio_due on public.raven_studio_sources(next_check_at,priority desc) where enabled=true;
create table if not exists public.raven_studio_checks(
 id bigint generated always as identity primary key,
 source_id uuid not null references public.raven_studio_sources(id) on delete cascade,
 checked_at timestamptz not null default now(),status text not null,fetched integer not null default 0,
 eligible integer not null default 0,http_status integer,duration_ms integer,error text
);
create index if not exists raven_studio_checks_by_source on public.raven_studio_checks(source_id,checked_at desc);
create table if not exists public.raven_studio_cron_auth(id integer primary key default 1 check(id=1),token_hash text not null);
alter table public.raven_studio_sources enable row level security;
alter table public.raven_studio_checks enable row level security;
alter table public.raven_studio_cron_auth enable row level security;
revoke all on public.raven_studio_sources,public.raven_studio_checks,public.raven_studio_cron_auth from anon,authenticated;
insert into public.raven_studio_sources(studio_name,slug,provider,board_key,careers_url,priority,interval_hours) values
('BulletFarm','bulletfarm','ashby','bulletfarm','https://bulletfarm.com/careers/',3,6),
('thatgamecompany','thatgamecompany','ashby','thatgamecompany','https://jobs.ashbyhq.com/thatgamecompany',3,6),
('Believer','believer','ashby','believer','https://jobs.ashbyhq.com/believer',3,6),
('HyperHug','hyperhug','ashby','hyperhug','https://jobs.ashbyhq.com/hyperhug',2,24),
('Bloxd','bloxd','ashby','bloxd','https://jobs.ashbyhq.com/bloxd',2,24),
('Stellar Entertainment','stellarentertainment','ashby','stellarentertainment','https://jobs.ashbyhq.com/stellarentertainment',2,24),
('Supercell','supercell','ashby','supercell','https://jobs.ashbyhq.com/supercell',2,24),
('Larian Studios','larian-studios','lever','larian','https://jobs.lever.co/larian',2,24)
on conflict(slug) do nothing;

-- Seed the discoverable studio encyclopedia without pretending career APIs
-- have been confirmed. These records remain pending until verified.
insert into public.raven_studio_sources(studio_name,slug,provider,priority)
select name,
 trim(both '-' from regexp_replace(lower(name),'[^a-z0-9]+','-','g')),
 'pending', case when name=any(array['Remedy Entertainment','Frictional Games','Bloober Team','id Software','MachineGames']) then 3 else 2 end
from unnest(array[
'id Software',
'Bethesda Game Studios',
'MachineGames',
'Arkane Studios',
'Tango Gameworks',
'Remedy Entertainment',
'Frictional Games',
'Bloober Team',
'Striking Distance Studios',
'Motive Studio',
'DICE',
'Respawn Entertainment',
'Sledgehammer Games',
'Infinity Ward',
'Treyarch',
'Raven Software',
'Insomniac Games',
'Naughty Dog',
'Santa Monica Studio',
'Bend Studio',
'Guerrilla Games',
'Housemarque',
'Bluepoint Games',
'CD Projekt Red',
'Techland',
'4A Games',
'GSC Game World',
'Crytek',
'Ubisoft Montreal',
'Ubisoft Massive',
'Avalanche Studios',
'IO Interactive',
'Eidos Montreal',
'Crystal Dynamics',
'Blackbird Interactive',
'Digital Extremes',
'Obsidian Entertainment',
'The Coalition',
'343 Industries',
'Certain Affinity',
'Highwire Games',
'Studio Wildcard',
'Epic Games',
'The Chinese Room',
'Supermassive Games',
'Gunfire Games',
'Airship Syndicate',
'People Can Fly',
'Undead Labs',
'InXile Entertainment',
'Playground Games',
'Turn 10 Studios',
'Compulsion Games',
'Kojima Productions',
'Capcom',
'Konami',
'Saber Interactive',
'Focus Entertainment'
]) as names(name)
on conflict(slug) do nothing;
