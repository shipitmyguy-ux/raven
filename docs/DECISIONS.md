# Raven Architecture Decisions

## 2026-09-18 - GitHub is the canonical project-state store
All code, project documentation, task state, architecture notes, and Work handoffs must be durable in GitHub. Chat/Work conversation history is not authoritative.

## 2026-09-18 - Supabase is the live application-data source of truth
Live jobs, applications, descriptions, document records, and related runtime data belong in Supabase. Google Sheets is backup/export, not the primary live database.

## 2026-09-18 - Work is an execution environment, not a state store
Work should start by reading GitHub and end by committing/pushing changes and updating the handoff/status/task files.

## 2026-09-18 - Public runtime settings remain in runtime-config.json
The Options/Settings UI should reuse the existing runtime configuration system rather than introduce a second configuration architecture. User-specific UI overrides may persist locally where appropriate while retaining runtime config as defaults.

## 2026-09-18 - Verification is stronger than queue acknowledgement
Background work such as document generation is not considered functional until a real result is produced, associated correctly, and survives refresh.

## 2026-09-18 - Mobile app work is out of current scope
Raven scope is web application + browser-extension workflows unless explicitly changed.
