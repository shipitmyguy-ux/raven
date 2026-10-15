-- Official game studio careers -> provider linkage verified from public pages.
-- Source-specific evidence; no inferred company ownership or generated openings.
UPDATE public.raven_studio_sources
 SET provider='ashby',board_key='arenanet',
     careers_url='https://www.arena.net/en/careers',
     source_kind='studio',segment='major',
     segment_note='Guild Wars developer. Official career page links directly to Ashby applications.',
     verification_status='verified',
     verification_note='Official arena.net/en/careers links to jobs.ashbyhq.com/arenanet/.../application. Public job board is explicitly ArenaNet. No employer-wide NCSOFT board is scanned.',
     source_verified_at=now(),enabled=true,priority=3,interval_hours=24,next_check_at=now(),updated_at=now()
 WHERE slug='arenanet' AND provider='pending' AND verification_status='pending';

UPDATE public.raven_studio_sources
 SET provider='teamtailor',board_key='cinnamon',
     careers_url='https://www.cinnamon.co.uk/careers',
     source_kind='studio',segment='indie',
     segment_note='Roblox studio with worldwide remote contractor talent pipeline.',
     verification_status='verified',
     verification_note='First-party cinnamon.co.uk/careers links directly to cinnamonsoftware.teamtailor.com/jobs/7824035-general-application. Public Teamtailor listing 8157708 accepts worldwide remote contractors but explicitly describes an ongoing talent pool, not an urgent opening.',
     source_verified_at=now(),enabled=true,priority=2,interval_hours=24,next_check_at=now(),updated_at=now()
 WHERE slug='cinnamon' AND provider='pending' AND verification_status='pending';
