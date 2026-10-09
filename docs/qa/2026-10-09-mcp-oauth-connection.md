# OAuth discovery and consent release — 2026-10-09

PR [68](https://github.com/shipitmyguy-ux/raven/pull/68) merged at a2936122841d60c668ae8ed6fd9ad81847edb45a. Final source head b210ea6b770bda7156c19104fcbfee4d16e2f795. Existing Option 3 push/deployment authorization applies; no paid provider activated.

## Delivered
- Bridge 0.3.0 supports protected-resource metadata and 401 OAuth challenge, strict JOSE 6.2.12 signature/issuer/resource-audience/expiry/owner/client/session-claim checks, and explicit expiring server-side client/job/permission grants.
- Existing bearer grants and document-validation/CAS/archive persistence are preserved. No new document writes were performed in production.
- Consent/sign-in page uses the existing public runtime configuration, pinned Supabase SDK 2.117.3/SRI, email links/codes, explicit approve/deny, safe client text rendering and registered callback validation. Previously approved redirects require a continuation click.

## Actually verified
- Nineteen bridge/OAuth cases pass, including actual locally signed JWT verification/rejection, grant removal/expiry, least privilege and existing save/race/archive behavior with synthetic storage.
- All core commands and syntax/secret/whitespace checks pass. Four installed-Edge page cases pass: synthetic sign-in/sign-out, explicit consent/client escaping/unexpected callback rejection, prior-consent continuation and real SDK/SRI loading at 375px. Mobile screenshot visually inspected without overflow.
- User enabled Supabase OAuth; live discovery returned 200. Public JWKS reports ES256. Owner Auth-user count was zero before user sign-in setup.
- User then signed in successfully through the hosted page; direct database read confirms one email-verified Auth account. No active OAuth client is registered yet. No account UUID or email is stored in this public QA record.
- raven-mcp-v1 is ACTIVE v3. Live metadata GET returns 200 with exact issuer/resource and email identity scope. Anonymous, public-key and unrelated-key signed-JWT POSTs each return 401. Challenges identify the metadata URL. No private job/profile access occurred.
- Hosted consent page returns 200 with expected content. Final PR core 37952856732 and full-browser 37952856793 passed. Main core 37953058958, full-browser 37953059014, Pages 37953059098 and both smoke runs 37953059027 / 37953250794 passed.

## Observed failures and repairs
- First deployment metadata returned 401 because Supabase strips the functions/v1 gateway prefix. Added exact forwarded-path matches and regression assertions; v3 live metadata now returns 200.
- Clean CI lacked the new JOSE test dependency. Added npm ci with scripts disabled to core job; final CI passed.
- A deployment connector transport error occurred. Live endpoint and function inventory confirmed no version advance before retry; retry produced v3 and was verified.
- Windows checkout line endings caused a renderer freshness mismatch; local regeneration has no content diff. No renderer source change was committed.

## Remaining acceptance and limits
- Dashboard Site URL, authorization path, redirect URLs and DCR require user configuration. Registration endpoint was absent from the last discovery check.
- Owner sign-in is complete. Configure its UUID and explicit client/job grants server-side, and a custom token hook that issues the exact bridge audience for the approved client. Generic authenticated audiences and ID tokens are intentionally rejected.
- Supabase does not currently support custom application OAuth scopes. Standard email scope supplies identity; Raven permissions come from the server grant.
- Real OAuth client consent/token issuance, production grant/session revocation and expiry, authenticated MCP read/save, ChatGPT generation and Raven full-refresh persistence remain unverified.
- JWT signature validation does not prove immediate Supabase consent/session revocation. Server grant removal is the tested immediate bridge revocation control.
- User reports chat links do nothing but copy/paste in an external browser works. This is a navigation symptom, not a reproduced Raven defect.

No saved user document/application changed, no document was approved, and no employer application was submitted.
