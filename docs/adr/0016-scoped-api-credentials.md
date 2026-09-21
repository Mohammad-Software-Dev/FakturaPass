# ADR 0016: Workspace-scoped opaque API credentials

Status: accepted for implementation; live provider and production acceptance remain separate.

Use 256-bit random opaque secrets with SHA-256-only persistence. Bind each credential to one workspace, verified owner, environment and OIDC authority. Require an explicit operation scope and the owner's current database membership on every request. Unsupported endpoints fail closed; credentials cannot administer access.

OIDC administrators create finite-lived keys. Rotation is owner-only, version-checked and immediately replaces the hash without extending expiry or permissions. All administrators can revoke workspace keys. Never return existing secrets; creation and rotation responses use no-store headers and the browser keeps the new secret only in component memory.

Record lifecycle and admitted-use events without secrets. Rotation/revocation serialize with authentication; an already admitted request may finish. Existing business operations keep their role checks, tenant boundaries, idempotency and evidence requirements. Restored credentials must be revoked before cutover because backups can resurrect old digests.

This is user-owned integration access. Service accounts, delegated support access, external JWT bearer verification, rate/capacity acceptance and production provider configuration are separate work.
