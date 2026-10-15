-- Official studio->ATS links verified live on October 14, 2026.
-- IllFonic's first-party careers page links directly to illfonic.breezy.hr.
-- Mob Entertainment's first-party site links directly to greenhouse/mobentertainment.
-- Both public provider feeds expose open US-based environment roles; no invented jobs.
UPDATE public.raven_studio_sources
SET provider='breezy',
    board_key='illfonic',
    careers_url='https://www.illfonic.com/careers/',
    source_kind='studio',
    segment='indie',
    segment_note='US independent game developer; official Breezy board verified.',
    verification_status='verified',
    verification_note='Official illfonic.com/careers links directly to illfonic.breezy.hr; public /json reports IllFonic employer identity and 2026-09-29 principal environment artist (US remote).',
    source_verified_at=now(),enabled=true,priority=3,interval_hours=24,
    next_check_at=now(),updated_at=now()
WHERE slug='illfonic' AND provider='pending' AND verification_status='pending';

UPDATE public.raven_studio_sources
SET provider='greenhouse',
    board_key='mobentertainment',
    careers_url='https://www.mobentertainment.com/',
    source_kind='studio',
    segment='indie',
    segment_note='Independent US horror game studio, Poppy Playtime.',
    verification_status='verified',
    verification_note='Official mobentertainment.com careers link opens job-boards.greenhouse.io/mobentertainment; live boards-api.greenhouse.io/v1/boards/mobentertainment/jobs?content=true contains US environment artist roles.',
    source_verified_at=now(),enabled=true,priority=3,interval_hours=24,
    next_check_at=now(),updated_at=now()
WHERE slug='mob-entertainment' AND provider='pending' AND verification_status='pending';
