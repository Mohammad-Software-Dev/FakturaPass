# FakturaPass Release A implementation plan

The authoritative START HERE and technical contracts govern this build. Release A is a local synthetic-data application; Release B/C retain their documented customer, domain, security and production decision gates.

1. Establish the TypeScript/Next.js monorepo, PostgreSQL migrations, Java validator, reproducible dependency manifests and local startup.
2. Materialize the closed canonical JSON schema and fixtures; implement decimal invariants, support boundaries and deterministic UBL serialization. Execute the real pinned validator and record specification conflicts.
3. Persist tenant-scoped source bytes, immutable revisions, validations, approvals, generated artifacts and evidence. Implement idempotency, version binding, durable leased jobs and retry reconciliation.
4. Implement the documented REST API, local server-derived identity, role checks, payload boundaries, request correlation and authorized downloads.
5. Build the German invoice list, preview/import, revision workspace, layered findings, approval/generation, evidence and settings screens.
6. Verify schema, arithmetic, official fixtures, negative cases, API contracts, isolation, retries, browser workflows and production build; document exact commands and remaining release gates.

Acceptance evidence is recorded in RELEASE_A_RESULTS.md. A task is complete only when its real implementation and applicable checks pass; no simulated official validation or recipient acceptance is permitted.

## Pilot preparation after Release A

7. **FP-008 — CSV import:** implement deterministic grouped dry runs, immutable tenant mappings, row/column findings, full preview, atomic import and source/recipe evidence. The local engineering slice is implemented; see CSV_IMPORT.md. Acceptance against a real customer export remains open.
8. **FP-009 — recipient requirements:** add versioned evidence, expiry and coverage checks. Verified recipient requirements depend on supplied authoritative evidence; current reference presets remain unverified.
9. **FP-004 and operational readiness:** replace local identities with the selected production OIDC provider and complete production membership/scoped-key behavior, then verify hosting, backups and recovery. Provider and deployment decisions remain in TBD.md.
10. Run the controlled pilot acceptance with approved customer mappings, recipient evidence and operational ownership. Only then assess the next release gates.

These steps preserve the original plan's production/customer gates. Completing the CSV engineering work does not constitute production or pilot acceptance.
