# ADR 0014: Explicit workspace context per browser tab

Status: implemented, 21 September 2026.

An OIDC session identifies the verified issuer/subject. Users with multiple active memberships choose a workspace explicitly. The selected workspace lives in the tab URL and server-rendered page, rather than a mutable session selection shared across tabs.

OIDC workspace API requests require X-Workspace-Id. GET navigation and downloads can instead supply a workspace query parameter. Conflicting or duplicate selectors are rejected. Each request resolves current active membership and role in that workspace; the selector is never authority by itself. Local development authentication remains scoped to its configured tenant.

A multi-workspace session stores no implicit tenant. The membership composite foreign key permits a null tenant; initial login still requires an active membership. The chooser can show an empty state when all access is later suspended. Choosing another workspace does not extend session expiry or rotate the identity cookie, so other tabs retain their explicit context.

Workspace selection itself is read-only. Invoice, access and other mutations retain their existing tenant-specific audit records. Organization provisioning and verified invitations remain separate increments.
