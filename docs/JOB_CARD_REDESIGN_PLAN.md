# Raven job-card UI review and redesign plan

## What the current card is doing

Raven is a kanban board grouped into Bookmarked, Active jobs, Tailoring, Applied, Interview, Offer, Rejected, and Archived / ignored. Each collapsed card carries the role, company, location, a generated summary, optional salary, age, status or applied markers, and floating bookmark/ignore controls. Selecting a card expands a substantial work area inside the board. The board uses multiple columns on larger screens and collapses to one column on mobile.

The expanded card currently combines several different jobs:

- **Role context:** lifecycle selector, follow-up date when Applied, job summary with a show-more control, configured detail rows such as salary, source, notes, resume, and cover letter.
- **Application actions:** View listing, Apply on site, Prepare application when enabled, Approve docs / Apply with docs, Mark applied, Generate both, ChatGPT both, and Import AI docs. Which controls appear depends on status, saved documents, and feature flags.
- **Per-document actions:** an empty document can offer Generate, ChatGPT, and Import. A saved document offers Review plus an overflow menu for Word download, requested changes, regenerate, Drive PDF, ChatGPT prompt, import, and delete.
- **Supporting information:** evidence coverage, the activity log and add-activity form, and interview snapshot/context when applicable.

This is capable, but the selected card asks the user to parse a dense set of controls before the next step is obvious. Several controls overlap in intent or target the same destination. For example, View listing and Apply on site both open the listing; Apply on site and Prepare application both start an application journey; the lifecycle selector and the Applied toggle can both change application status; and document generation, ChatGPT generation, and import are shown as parallel first-class choices. Applied is also represented with a badge and a separate action-style control. On top of the visible complexity, `styles.css` has multiple later sections that restyle the same card, details, and action selectors, so future changes are harder to reason about.

Relevant implementation: [app.js](../app.js:1184), [app.js detail rendering](../app.js:1488), [app.js document controls](../app.js:2655), and [styles.css](../styles.css:1113).

## Redesign goals

1. Make one status-aware next step visually dominant, with its effect stated plainly.
2. Give resume and cover letter one consistent row each: current state, one primary action, and advanced actions behind a menu.
3. Keep “prepare” separate from “applied.” Opening a prepared employer form must never imply approval or submission.
4. Preserve the useful board scan: role, employer, location, remote status, salary when known, and a clear stage.
5. Keep evidence, activity, and interview context reachable while placing secondary information below the main action area.
6. Keep keyboard and mobile use practical; avoid tiny icon-only actions for important decisions.

## Two distinct layout directions

### Option A — Pipeline board with a focused right-side detail panel (recommended starting proposal)

Keep the current stage columns and compact cards, but stop expanding the selected card inline. Clicking a card opens a right-side panel on desktop, or a full-height sheet on mobile. The panel has a stable order: role and employer with status; one next-step button; two document rows; then collapsible Job details, Evidence, and Activity sections.

The primary action changes by stage and document state: for an active role it could be **Prepare application** when both documents exist, or **Create missing documents** when they do not. Tailoring foregrounds document work. Applied foregrounds follow-up or interview preparation and may offer **Prepare again for review** as a secondary action. The action itself never changes Applied or approval state. Each document row has **Generate** or **Review** as its main control. Regenerate, revise, export, import, and delete stay in that row’s overflow menu. “Apply on site”/“View listing” becomes one clearly named employer link.

This keeps the pipeline mental model and reduces board reflow. It also gives the dense details room without making the board jump as a long card opens. The trade-off is an extra panel interaction and a need to make the selected card obvious.

### Option B — Focused job queue with a dedicated application workspace

Replace the multi-column board as the primary surface with a strong list of jobs and filters. A selected role opens a full application workspace: a compact role header, status timeline, document checklist, and the current next task. Sections or tabs separate **Overview**, **Documents**, **Application**, and **History**. The top action area can guide a linear process: check role → create/review documents → prepare employer form → record Applied only after the user confirms submission.

The list stays scannable and predictable on desktop and mobile, while the workspace can support longer tasks and status-specific prompts without squeezing them into a card. The trade-off is that users lose the at-a-glance comparison of multiple pipeline stages and may need more navigation to move between jobs.

## Proposed control cleanup

| Current overlap | Proposed treatment |
|---|---|
| “View listing” and “Apply on site” open the same URL | Use one employer link, named for the current task; keep it separate from document preparation. |
| “Prepare application” and “Apply with docs” / “Approve docs” | Make Prepare the guided, reviewable browser handoff. Keep approval and submission as explicit, separate actions only where they are still needed. Explain that preparation opens a form; it does not submit it. |
| Lifecycle dropdown and quick “Applied” action | Choose one primary status control. Prefer a status chip/menu for changing stages; show “Mark applied” as a single action only before Applied. For Applied, show follow-up and interview actions instead of a redundant Applied button. |
| Generate both plus per-document Generate, ChatGPT, and Import choices | Keep one default “Create missing documents” action, then show resume and cover letter state rows. Put manual ChatGPT/import routes in an Advanced menu unless users say they rely on them daily. |
| Review button plus overflow “Request changes” and “Regenerate” | Keep Review as the document’s main action; retain revision/regeneration in the overflow. Label the menu “More” with accessible text. |
| Activity, evidence coverage, notes, and full posting text all expanded together | Keep a short role summary visible and move long text, evidence, and history into named disclosure sections. Show interview context only for interview-stage jobs. |
| Applied check badge plus green Applied action | Use one clear status badge in both collapsed and expanded views. Status should not look like a second completion button. |
| CSS card and action styles repeated across later sections | After choosing a layout, consolidate the card/detail rules into one authoritative component block and remove obsolete overrides after visual comparison. |

These are proposals, not a commitment to remove those capabilities. Before implementation, confirm whether manual ChatGPT/import is a routine workflow or a fallback, whether the board itself is important for daily triage, and whether opening a separate detail panel is preferable to inline expansion.

## Additional live workflow observations

A live Believer document-reset check surfaced two more clarity problems: the reset left an earlier generation failure and earlier Drive exports visible beside the now-empty document controls, and progress showed repeated “Writing” messages in multiple controls. These observations were relayed during the live check; I did not independently reproduce them in the browser.

The card should distinguish the current document revision from its history. Bind the visible current-document link and failure state to the document version/hash; after reset, move prior exports and failures into a clearly historical activity entry instead of presenting them as the current file. For active work, use one progress region with a single current stage and the affected document names. Keep per-document rows focused on their final state, rather than repeating the same stage label in the card header, global status, and action buttons.

| Newly observed confusion | Proposed treatment |
|---|---|
| Old failure and Drive exports remain beside a reset document | Version-bind current document/export controls; label superseded attempts as history and do not present them as current output. |
| The same “Writing” stage appears in several controls | Maintain one status/progress area with stage and document names; keep button labels stable while work runs. |

## Preferences to validate

- **Primary work view:** keep the kanban board (Option A) or move to a focused list/workspace (Option B)?
- **Default next step:** should an eligible active job foreground Prepare application, document creation/review, or opening the employer listing?
- **Manual document paths:** should ChatGPT and Import remain visible on the card, or move under More / Advanced?
- **Applied behavior:** should Applied cards foreground follow-up scheduling, interview prep, or both?
- **Detail placement:** side panel, mobile sheet, or inline expansion?
- **Information density:** show salary/notes/coverage immediately when present, or keep the first screen minimal and disclose them on demand?

## Evidence and scope

This is a source-level audit of the renderer and stylesheet, supplemented by the owner’s live Believer workflow observations above. I could not inspect that live Raven tab safely because it belonged to an active application-test session. No browser state or job data was changed by this audit. The implementation plan should be validated against desktop and phone screenshots, plus one ordinary active job, one Applied job, and one job with missing documents before any UI is removed.
