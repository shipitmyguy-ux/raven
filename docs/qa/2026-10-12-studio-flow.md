# Studio discovery → document prompt acceptance (2026-10-12)

## Verified without user-record writes

- Read the public People Can Fly SmartRecruiters list and detail endpoints. The immutable Node fixture uses the actual Senior Level Artist — Remote, Canada posting `744000151377560`, including company description, responsibilities, qualifications and additional information. No candidate profile is in the fixture.
- The actual shared title and location filters accept this remote level-art role. Its Canada geography is retained; acceptance does not establish the candidate's eligibility for a Canada-restricted role.
- `node --test tests/studio-to-resume.test.mjs`: **2 passed**. The test executes the real provider normalizer/detail collector, browser discovery normalizer, adoption/preparation function and prompt-request function. It verifies the entire >5,000-character normalized public description reaches `jobDescription`, with canonical URL and adopted job ID, and survives persisted-job normalization/reload. Both resume and cover-letter prompt requests preserve it. All persistence and prompt calls are in-memory fixtures; no actual generator or saved job/document was called or changed.
- An empty description refresh prevents the prompt request; it cannot silently generate from missing text.
- Read-only production `listResults` GET initially returned no People Can Fly row, although a read-only database check confirmed the public discovery record exists. Root is fixing the score-ranked results-window starvation. Frontend `filteredJobs()` does not slice the available discovery pool.

## Browser coverage and limitations

`e2e/studio-job-flow.spec.mjs` mocks every Edge Function request and exercises the studio card, expanded description, adoption, ChatGPT prompt-only request, and persisted reload. It imports only the public snapshot data from the Node fixture. No real user records or generation calls occur.

The local Playwright invocation was **blocked before page execution** because the Chromium headless-shell binary is unavailable. This is a fixture ready for the normal browser CI, not a claimed browser pass.

## Follow-up live check

After backend deployment, repeat the public `listResults` GET and confirm the persisted People Can Fly role and full description appear in its output. Node acceptance establishes transport through the prompt request; no actual resume output is claimed, because producing/saving candidate documents is outside this read-only acceptance task.
