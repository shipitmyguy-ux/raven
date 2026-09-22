# Raven backup and restore

Supabase Postgres is Raven's only live source of truth. GitHub stores schema/code; this procedure stores Raven data. Google Sheets is not a live backup target.

## What the backup contains

A **core** backup contains the durable Raven state required to recover the application:

- `raven_jobs` — saved jobs, statuses, notes, generated resume/cover-letter data stored on jobs
- `raven_bookmark_keys` — bookmark-key hashes and expiry/rate-window state
- `raven_bookmark_urls` — canonical bookmark URL-to-job mappings

A **full** backup additionally captures operational/search/cache/legacy tables:

- `raven_commute_cache`
- `raven_search_results`
- `raven_search_runs`
- `raven_tasks` (retired queue history)
- `raven_source_diagnostics` (audit-only)
- `raven_request_events` (audit-only)

The two audit tables use generated identity IDs. They are exported for forensic/reference purposes but are intentionally **not replayed** by the restore tool.

The backup does **not** include device-local IndexedDB/localStorage master-resume files, application profile/answer-memory data, browser caches, or external Google Drive files. Those need separate recovery if they matter.

## Security

Backups can contain resumes, cover letters, job notes, and chat context. Treat every backup as private.

- Write backups under `private/`; that directory is gitignored.
- Never commit backup JSON files.
- Prefer `SUPABASE_SECRET_KEY`; `SUPABASE_SERVICE_ROLE_KEY` remains supported as a fallback while Raven migrates off legacy keys.
- The scripts send the elevated key only as the `apikey` request header.
- The key is never serialized into the backup.
- Export files are created with mode `0600` where the OS supports it.

## Create a backup

Set the project URL, then enter the secret without placing it in the command itself:

```bash
export SUPABASE_URL="https://<project-ref>.supabase.co"
read -s SUPABASE_SECRET_KEY
export SUPABASE_SECRET_KEY
```

Core snapshot:

```bash
npm run backup:raven
```

Full snapshot:

```bash
npm run backup:raven -- --scope=full
```

Custom output:

```bash
npm run backup:raven -- --scope=full --output=private/raven-before-migration.json
```

Each backup contains per-table row counts, per-table SHA-256 hashes, and a whole-payload SHA-256 hash.

## Verify a backup

```bash
npm run verify:backup -- private/raven-before-migration.json
```

Verification must pass before a backup is used for recovery.

## Restore prerequisites

1. Deploy the Raven schema/migrations to the target Supabase project first. The JSON backup restores **data**, not schema, RLS, functions, indexes, or Edge Functions.
2. Stop or avoid Raven writes while doing an exact restore.
3. Set `SUPABASE_URL` and a server-side secret key for the target project.
4. Verify the backup checksum.
5. Run a dry run before any write.

## Restore: dry run

Core durable data only:

```bash
npm run restore:raven -- private/raven-before-migration.json
```

Include operational/search/cache/legacy rows from a full backup:

```bash
npm run restore:raven -- private/raven-before-migration.json --full
```

Dry run is the default and writes nothing.

## Restore: merge

```bash
npm run restore:raven -- private/raven-before-migration.json --apply
```

Use `--full` as well to restore supported operational tables.

Merge uses PostgREST upsert on each table's primary key. It is intended for recovery into the same Raven dataset. If the target has diverged IDs for the same unique job URL, use an exact replace instead of trying to merge two independently modified datasets.

## Restore: exact replace

This deletes selected target-table rows before replaying the snapshot. It is intentionally guarded.

```bash
export RAVEN_RESTORE_CONFIRM=RESTORE_RAVEN
npm run restore:raven -- private/raven-before-migration.json --apply --replace
```

Add `--full` to replace supported operational tables too.

Restore order preserves the only current foreign-key dependency: `raven_jobs` is restored before `raven_bookmark_urls`. Destructive clearing happens in reverse order.

## Post-restore verification

After an applied restore:

1. Check `raven-backend-v3?action=health`.
2. Check `raven-enrich-v1?action=health`, `raven-commute-v1?action=health`, and `raven-generate-v1`.
3. Compare restored table counts with the backup manifest.
4. Open Raven and confirm saved jobs/statuses/documents survive a reload.
5. Confirm chat bookmarking resolves an existing canonical URL without making a duplicate.
6. Run one global Refresh all jobs and confirm all four tabs receive fresh results.
7. Only then resume normal writes.

## Recovery priorities

For a disaster recovery where speed matters:

1. Restore **core** data first.
2. Verify job/status/document state.
3. Let Raven rebuild search results and commute cache naturally.
4. Restore full operational history only if it is useful for investigation.

This keeps recovery focused on user-owned durable data rather than transient search/runtime state.
