# Raven execution handoff

## Generate both and overlapping document requests — 2026-10-13

User reported Generate both failing and cover-letter requests blocked during resume generation. Root causes: Generate both bypassed the enabled local helper; one-click reservation covered the whole job rather than each requested document. Implemented app88 unified routing and document-specific reservations with durable busy labels and selected-job review guard. Helper keeps its serialized save/export queue to preserve canonical version/grant safeguards; another document may be accepted while the first runs and waits its turn. Existing documents, approvals and applications preserved. Added actual-server regression for same-job resume-running/cover-queued/completed. Six focused Edge browser cases and25 oneclick Node cases pass. Actual helper both request b64da602-f68e-4228-9451-5e2bd204e3ea confirmed existing Streamline resume/cover and both verified Drive files preserved. GitHub release checks/publication pending.

Previous one-click release PR74/app87 remains published and verified; see docs/ONE_CLICK_RESUMES.md. Worker is updating app/index/browser regressions; root owns server acceptance and release. Prior protected local helper running, grant expires November1. No automatic approvals/employer submissions. Preserve ignored personal/private files and all-track dedup implementation.
