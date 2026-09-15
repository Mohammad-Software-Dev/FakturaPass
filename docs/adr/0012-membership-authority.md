# ADR 0012 — Database memberships determine application authority

Status: implemented local foundation. Date: 15 September 2026.

The original authorization contract requires application-owned tenant permissions. Prior local bearer configuration carried a role alongside tenant and actor; changing a membership could not revoke that configured authority. Authenticated requests now resolve an active membership from PostgreSQL, and token-supplied roles have no effect. The local browser follows the same membership check.

Administrator changes are tenant-scoped, optimistic-versioned and audited. A tenant lock serializes changes, rechecks the acting administrator and protects the last active administrator. Suspension takes effect on the next request. Existing resource ownership and immutable evidence are preserved.

This supersedes the role-mapping detail in ADR 0009. It does not select a production identity provider or establish real user identities. The next adapter must verify issuer/subject and session validity before constructing a tenant context; it must reuse these membership checks. Local subject names are development identifiers, not verified emails. Production invitations, sessions, tenant selection and API-key scopes remain open.

Alternatives: retaining roles in token configuration prevents timely revocation; trusting client role/tenant claims violates the authorization boundary. Neither is used. Consequence: local API actors require actual active membership records. Reversal trigger: an approved identity or authorization architecture change with isolation and revocation acceptance.
