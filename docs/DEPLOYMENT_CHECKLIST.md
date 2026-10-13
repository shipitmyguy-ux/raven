# Deployment Regression Checklist

Run automatically after a successful GitHub Pages deployment through `.github/workflows/production-smoke.yml`.

## Required checks
- Raven production page loads without page errors.
- All four job tabs render and remain filter-only.
- Job cards stay within the viewport and malformed ATS rows do not render.
- Refresh triggers the shared all-track backend path.
- Bookmark/status state survives a reload.
- Document review and approval state survives a reload.
- Application Assistant adapters preserve prefilled values, attach only compatible approved files, skip sensitive questions, and never submit an application.
- Core/unit regressions pass before merge.
- Repository secret scan passes before merge.

## Production data checks
- `raven-backend-v3` health reports zero active operational failures.
- Malformed ATS rows remain zero.
- Search refresh returns valid persisted results or cached results during a transient provider drought.
- Resume and cover-letter generators return canonical-fact-only output within request budgets.

A deployment is not considered verified if only the build succeeds; the smoke workflow must also pass.
