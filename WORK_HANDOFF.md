# Raven execution handoff

Latest task: correct ChatGPT button opening an empty chat.

## ChatGPT prompt handoff (2026-09-30)
- Frontend v71 carries the complete prompt in ChatGPT's `q` link instead of opening its bare homepage. Clipboard backup remains available, and blocked pop-ups are reported accurately.
- Four focused handler tests pass (long/unicode prompt preservation, clipboard denial, popup blocking, request failure); syntax and whitespace checks pass. Actual signed-in ChatGPT composer prefill is not verified here and may depend on ChatGPT handling the link.

Frontend-only change; no backend, saved-document, generation guard, or candidate-profile changes. Prior Accurx investigation remains documented in docs/qa/2026-09-30-accurx-number-review.md.
