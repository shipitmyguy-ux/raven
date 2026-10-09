# Raven execution handoff

## Protected-key ACL compatibility fix (2026-10-09)
Initial real enrollment failed because Windows PowerShell could not autoload Microsoft.PowerShell.Security for Set-Acl. Cache was not saved; the launcher disposed entered credentials. Replaced Set-Acl with direct .NET Windows file ACL APIs, preserving DPAPI/current-user-only protection and avoiding module-path incompatibility. Synthetic credential/retry/environment tests pass in both bundled PowerShell7 and Windows PowerShell5.1; actual protected enrollment remains pending repeat local entry. Corrected ignored cmd launcher to forward options on the PowerShell invocation rather than pause. Saved DataHouse resume/full hosted reload acceptance remains verified; no documents changed.

Next: finish protected local enrollment using repaired private/Start-Raven-Private.cmd, verify real health and read-only get_document hash. No keys in chat. Synthetic tests cannot substitute live enrollment. Preserve unrelated renderer/artifacts/Smile-Break JSON and keep PR58 inactive.
