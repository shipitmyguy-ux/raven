# Raven Deployment

## GitHub-first rule
Deployable changes originate from committed GitHub state.

## Session workflow
1. Pull latest default branch.
2. Read project-state files.
3. Implement and test.
4. Commit changes.
5. Push to GitHub.
6. Verify deployment/runtime behavior.
7. Update status/task/handoff files.

## Web
Raven is hosted from the GitHub repository. Verify the active GitHub Pages/workflow configuration before changing deployment behavior.

## Supabase
Database changes should be represented by durable SQL/migration artifacts in GitHub whenever possible.
Never commit service-role keys or secrets.

## Apps Script / external workers
If Apps Script or another worker remains part of Raven:
- keep source or reproducible deployment instructions in GitHub,
- document the currently active endpoint/configuration without committing credentials,
- do not treat a manually edited remote script as the only copy.

## Chrome extension
The extension source must remain under `extension/`.
Any deploy/package procedure should be reproducible from committed source.

## Secrets
Use secure environment/GitHub/Supabase configuration.
Never place secrets in `runtime-config.json`, `config.js`, documentation, or committed workflow source.

## Completion
A deployment task is complete only after runtime behavior is verified, not merely after a push succeeds.
