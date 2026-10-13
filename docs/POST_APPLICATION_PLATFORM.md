# Raven Post-Application Platform

## Goal

Keep post-application behavior on one shared lifecycle instead of creating separate systems for follow-ups, interviews, recruiter contacts, email matching, and analytics.

## Canonical flow

Discovered -> Saved/Bookmarked -> Ready -> Applied -> Interview -> Offer / Rejected

Ignored remains terminal but reversible.

All lifecycle changes use the same backend transition API. The frontend does not own the lifecycle rules.

## Persistence

### raven_job_events

Generic timeline records:

- job_id
- event_type
- occurred_at
- source
- summary
- confidence
- metadata

Examples: `applied`, `follow_up_changed`, `follow_up_sent`, `recruiter_contact`, `assessment`, `interview_requested`, `interview_scheduled`, `interview_completed`, `offer`, `rejected`, `note`, and external `signal_*` records.

### raven_job_snapshots

Immutable application-time snapshots containing the job posting and the resume/cover letter state associated with that application.

The browser has no direct table access. Raven backend uses the service role. Snapshot UPDATE is not granted.

## Shared backend operations

- `transitionJob`
- `jobEvents`
- `addJobEvent`
- `jobSnapshots`
- `receiveApplicationSignal`
- `analytics`

## Application signal contract

External adapters should send the same shape rather than updating Raven status directly:

```json
{
  "jobId": "JT-...",
  "type": "interview_requested",
  "occurredAt": "2026-09-23T12:00:00Z",
  "source": "email",
  "confidence": 0.93,
  "summary": "Recruiter requested an interview.",
  "evidence": "Short non-sensitive evidence excerpt"
}
```

Matching priority:

1. explicit Raven job ID
2. canonical job URL
3. exact title + company when that match is unique

High-confidence lifecycle signals can advance state automatically. Lower-confidence matches are stored as reviewable suggestions and do not change lifecycle state.

Signals never move a job backward from a later lifecycle state.

## Interview mode

Interview jobs reuse existing Raven state instead of creating a separate interview project. The job detail surfaces:

- immutable application snapshot
- original posting URL
- submitted resume
- submitted cover letter
- activity timeline
- recruiter/interview notes

## Analytics

Analytics are derived from jobs + lifecycle events. Raven currently reports:

- application count
- interview count/rate
- offer count/rate
- rejection count
- average response time
- outcome breakdown by source
- outcome breakdown by track

No separate analytics counters are written.

## Email integration boundary

The backend signal contract is ready for an email adapter. Raven does not yet request or store personal email/OAuth credentials. A future adapter should classify messages outside the lifecycle layer and submit only the minimum signal/evidence needed through `receiveApplicationSignal`.

## Backup

`raven_job_events` and `raven_job_snapshots` are part of the durable backup scope and restore after `raven_jobs`.
