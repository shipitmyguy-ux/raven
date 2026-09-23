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


## Interview classification

High-confidence interview signals describe an actual invitation or scheduling step, for example:

- invite you to interview
- would like to schedule an interview
- choose/select an interview time
- schedule a phone screen or screening call
- meet or speak with the hiring manager as the next hiring step
- invite you to a second/final interview

Public interview templates use the same structure: the employer states interest in the application, explicitly asks to schedule an interview, identifies the interviewer, and often supplies time slots.

### Synthetic soft-interview example

> We enjoyed learning more about your background and would like to continue the conversation with our operations team. Could you choose one of the available times next week to meet with the hiring manager and discuss the Project Coordinator role?

Expected Raven classification:
- type: interview
- confidence: high

### Interview negative control

This is **not** an interview invitation:

> We received your application and will be in touch to schedule an interview if your background matches what we're looking for.

That language describes a future possibility, not an actual advancement decision.

## Offer classification

High-confidence offer signals include:

- pleased/excited/delighted to offer you the position
- formally offer you the role
- official/formal offer letter
- accept or decline this offer
- compensation/start-date terms presented as an employment offer

Observed real example:
- Wencor Group / SoundAir: “pleased to offer you” the Technician I position and provided an official offer letter for signature.

Public offer templates use the same semantic family: a direct statement that the candidate is being offered the job, followed by terms such as title, compensation, start date, and acceptance instructions.

### Synthetic soft-offer example

> The team was impressed with your background and would be happy to welcome you as our Implementation Coordinator. We have prepared the employment details, including compensation and a proposed October 12 start date, for your review. Please let us know whether you would like to move forward with joining the team.

Expected Raven classification:
- type: offer
- confidence: high

### Offer negative controls

These are **not** offers by themselves:

- we think you would be a great fit
- we would like to discuss compensation
- we are preparing next steps
- we hope you will join us someday
- recruiter marketing saying a company “may want to hire you”

The classifier requires an actual employment-offer decision or clear offer-document/acceptance language.
