# FakturaPass Release A implementation plan

The authoritative START HERE and technical contracts govern this build. Release A is a local synthetic-data application; Release B/C retain their documented customer, domain, security and production decision gates.

1. Establish the TypeScript/Next.js monorepo, PostgreSQL migrations, Java validator, reproducible dependency manifests and local startup.
2. Materialize the closed canonical JSON schema and fixtures; implement decimal invariants, support boundaries and deterministic UBL serialization. Execute the real pinned validator and record specification conflicts.
3. Persist tenant-scoped source bytes, immutable revisions, validations, approvals, generated artifacts and evidence. Implement idempotency, version binding, durable leased jobs and retry reconciliation.
4. Implement the documented REST API, local server-derived identity, role checks, payload boundaries, request correlation and authorized downloads.
5. Build the German invoice list, preview/import, revision workspace, layered findings, approval/generation, evidence and settings screens.
6. Verify schema, arithmetic, official fixtures, negative cases, API contracts, isolation, retries, browser workflows and production build; document exact commands and remaining release gates.

Acceptance evidence is recorded in RELEASE_A_RESULTS.md. A task is complete only when its real implementation and applicable checks pass; no simulated official validation or recipient acceptance is permitted.
