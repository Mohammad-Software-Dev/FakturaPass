# Scoped API credentials

Administrators using configured OIDC sign-in can open **Team → API access**. Create a named key, select permissions and choose 1–90 days of validity (30 days initially selected). The key belongs to the creating administrator's verified subject and the selected workspace. The duration range is an implementation safety limit, not a commercial retention or pricing policy.

Copy the secret immediately into your integration's secret store, then hide it. The application stores only its SHA-256 digest; listing credentials never returns the secret. It is not saved to browser storage. Do not include secrets in URLs, source control, screenshots or logs. Configure upstream request logging to redact `X-API-Key` and credential creation/rotation response bodies.

Send `X-API-Key: <secret>` to `/api/v1` over HTTPS outside LOCAL. No browser cookie, Origin or workspace selector is needed. If supplied, a workspace selector must match the key's workspace. `Authorization` and `X-API-Key` together are rejected. An invalid key never falls back to a browser session or LOCAL identity. Browser authentication endpoints reject API keys.

| Scope               | Operations                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invoices:read`     | Invoice list/detail/revisions/evidence, validation results, artifact metadata/downloads, recipient profiles/history, mapping recipes and review queue |
| `invoices:import`   | JSON ingestion, CSV preview/import                                                                                                                    |
| `invoices:edit`     | Create corrected revisions                                                                                                                            |
| `invoices:validate` | Request validation                                                                                                                                    |
| `invoices:approve`  | Record approval                                                                                                                                       |
| `invoices:generate` | Request artifact generation                                                                                                                           |
| `recipients:write`  | Publish recipient profiles                                                                                                                            |
| `review:write`      | Assign review tasks                                                                                                                                   |

Each operation also requires the owner's current active membership and the existing service role. For example, an import scope cannot let a read-only member ingest invoices. Approval is a separate explicit grant and still requires the approval role. The read scope includes invoice content and evidence; grant it only where needed. New endpoints default to inaccessible until explicitly mapped. Keys cannot manage memberships, invitations or credentials.

The OpenAPI contract publishes `x-api-key-scope` on supported operations. Ingestion still requires `Idempotency-Key`; validation, approval and generation still follow the existing revision and evidence workflow. A key does not skip those steps. A `401` means the credential is missing, invalid, expired, revoked or configured for another authority/environment. A `403` means scope, workspace or membership denies access. Do not retry either indefinitely; inspect the integration configuration and Team access.

## Rotation and revocation

The creating administrator can replace an active key. Confirming replacement invalidates the previous secret immediately and displays the replacement once. Owner, scopes and original expiry remain unchanged. Update the integration after replacement; this has no overlap window. To arrange a planned overlap, create a separate key, switch the integration, then revoke the original. This also supports renewal or changing scopes.

Any workspace administrator can revoke a key, including one whose owner is suspended. Other administrators cannot rotate someone else's key into a secret they control. Revoked and expired keys cannot be rotated. Version checks prevent two concurrent replacement requests from both succeeding. The UI shows status, expiry, permissions, environment and last admitted use.

Keys bind to issuer, client ID, application origin and environment. Changing these makes the old keys unavailable. Suspension blocks subsequent requests; restoring an owner's membership can restore access to an otherwise active key. Revoke keys for permanent offboarding. Requests already admitted may finish after revocation or a membership change; queued invoice jobs retain their existing workflow semantics.

Creation, rotation, revocation and admitted use are audited by credential ID, owner subject and request ID. Usage includes the credential version and scope; it records authentication admission, not business success. Business events retain the owner's subject and matching request ID. Secrets are never written to these audit records.

## Operations and limits

Migration `011_api_credentials.sql` adds the credential store. Apply migrations before enabling the updated application. LOCAL development authentication remains available as before; these management controls require OIDC mode. Configured live-provider acceptance, hosting, MFA policy and production load/abuse testing remain pending.

Before exposing a restored database, revoke **all restored API credentials** after fingerprint verification and record this in the recovery report. A snapshot may contain a formerly valid secret digest whose key was subsequently rotated or revoked. Issue fresh keys following recovery; do not rely on matching origin/environment to prevent resurrection. See RECOVERY.md.
