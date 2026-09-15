# ADR 0013: OIDC identity with application-owned sessions

Status: implemented for provider-independent verification; live provider acceptance pending.

Use standard OIDC authorization code flow with PKCE, state, nonce and signed ID-token validation. Bind application subjects to exact verified issuer/subject pairs. Do not link identities by email or accept roles from token claims.

Persist opaque session hashes and resolve active memberships on every request. Bind sessions to application origin, issuer, client and environment. Use same-origin POST for login/logout and writes. Sessions expire after eight hours; login transactions after ten minutes. These are explicit technical defaults to review during production acceptance.

The initial adapter requires a single active tenant membership. Invitations, tenant selection, scoped API credentials and support grants remain separate increments. Local development authentication is mutually exclusive with OIDC mode. Provider tokens are not persisted. App logout revokes the app session; provider SSO logout is outside this increment.
