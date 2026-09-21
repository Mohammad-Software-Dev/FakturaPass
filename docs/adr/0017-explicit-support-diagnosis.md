# ADR 0017: Explicit, revision-bound support diagnosis

Status: implemented for isolated acceptance; production identity and support-process approval remain open.

The authoritative contract states that SUPPORT is not a customer role and that support access must be time-bound, audited and explicitly authorized. Implement a separate specialist registry and grant store. Registration uses the existing verified issuer/subject identity and authority binding; it grants no workspace membership.

A customer administrator explicitly consents to one specialist reading a selected immutable invoice revision and its saved validation findings, for a bounded duration. One diagnostic scope is implemented. Broader tenant access, write permissions, impersonation, file downloads and grant delegation are excluded from this scope. Later corrections require a new grant.

Support-only OIDC sessions use a nullable tenant and a dedicated `/support` screen/API projection. General customer APIs continue to require membership. Every support access checks current grant, registry, authorizer and environment state. A suspended customer membership cannot be bypassed using support. Revocation is permanent; expiry is checked in PostgreSQL. Views and case-list reads have specialist-attributed audit events.

The UI clears expired/unavailable views, but previously disclosed data cannot be recalled. Operator suspension revokes all specialist grants. Recovery must revoke restored grants and reconcile the registry before cutover. Provider MFA, production capacity, privacy/support terms and external security acceptance remain deployment gates.
