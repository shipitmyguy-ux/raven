# Application Message Classification

Raven treats application-message classification as a reusable signal problem, not a Gmail-specific feature.

## High-confidence rejection language

The classifier should treat these as positive rejection signals when they refer to the user's candidacy:

- decided to pursue other candidates
- selected other candidates for further consideration
- selected another candidate
- moving forward with another or other candidate(s)
- will not move forward with your application
- not selected for further consideration
- regret to inform you + not selected
- moving forward with candidates whose experience/background/skills more closely align with the role
- continuing the process with candidates whose background more closely matches current needs

Observed real examples that informed the patterns:
- Lakshya Digital: explicitly stated it had decided to pursue other candidates whose skills and experience better met its needs.
- Astrid Entertainment: explicitly stated the application had not been selected for further consideration.

Public recruiting templates use the same semantic families: selecting other candidates, not moving forward, or selecting someone whose qualifications more closely align with the role.

## Synthetic soft-rejection example

This intentionally avoids the words "reject", "rejected", "unfortunately", and "not selected":

> Thank you for the time you invested in exploring the Operations Project Manager opportunity with Northstar Systems. After reviewing the applicant pool, we have chosen to continue the process with candidates whose backgrounds more closely align with our current needs. We appreciated learning about your experience and hope you will consider future opportunities with us.

Expected Raven classification:
- type: rejection
- confidence: high
- reason: continue-with-closer-aligned-candidates

## Important negative controls

These are **not** rejection evidence by themselves:

- thank you for applying
- thank you for your interest
- we received your application
- our hiring team will review your application
- we will contact qualified applicants
- encourage you to explore future openings (without a rejection decision)
- generic job alerts or recruiting marketing

A rejection classification requires an actual decision/progression signal, not polite language alone.

## Signal schema

External adapters may submit raw message text through the shared signal endpoint:

```json
{
  "jobId": "JT-...",
  "messageText": "<message body>",
  "source": "email",
  "occurredAt": "2026-09-23T12:00:00Z"
}
```

Raven classifies the message server-side. Only the matched evidence excerpt and classifier reason are persisted in event metadata; adapters do not need to create a separate Gmail-specific status system.
