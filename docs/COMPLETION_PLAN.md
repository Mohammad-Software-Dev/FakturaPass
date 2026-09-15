# FakturaPass completion plan

Baseline: 15 September 2026. This plan continues the original FP-001–020 backlog toward the sellable German SaaS v1. The local invoice pipeline and selected pilot features exist; neither paid-pilot nor commercial release acceptance is complete. Passing local tests is evidence for implemented behavior, not approval of providers, tax cases, recipient acceptance or launch.

## Delivery sequence

| Stage                               | Scope and backlog  | Deliverables                                                                                                                                                                                                                                                          | Completion gate                                                                                                                                          |
| ----------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Identity and organizations       | FP-004, FP-019     | Database-enforced active memberships, audited role/status changes, last-admin protection; organization setup and team UI; OIDC sign-in and sessions; invitations and tenant switching; scoped, hashed, expiring and revocable API credentials; scoped support grants  | Revoked access stops working, forged roles/tenant IDs fail, cross-tenant tests cover every resource; provider sandbox sign-in/logout/session tests pass  |
| 2. Staging and operational baseline | FP-003, FP-018     | EU hosting/storage recommendation and approved deployment; secrets/environment separation; request/job metrics and alerts; immutable application images, security/license/SBOM checks and retained release evidence; encrypted off-site backups and restore rehearsal | Clean deployment and rollback work; alerts are exercised; declared recovery targets measured; production data remains gated                              |
| 3. Pilot data and evidence          | FP-008–011         | Approved real export mapping and recipient instructions; complete export/archive handoff; retention metadata, holds where agreed, deletion request/audit workflow; reviewed reduced/mixed VAT and bounded attachments                                                 | Authorized corpus passes independently expected checks; customer approves mapping and archival responsibilities; unsupported cases remain blocked        |
| 4. Issued documents and transport   | FP-012–014         | Credit notes and replacement relationships; email adapter and sender setup; separate delivery/recipient outcomes; uncertainty reconciliation, bounce handling and immutable send evidence; signed webhooks with retries/replay and destination controls               | Sandbox failure tests and customer-approved route acceptance pass; no duplicate dispatch under retry/crash/restore; issued artifacts remain immutable    |
| 5. Commercial product features      | FP-015–017, FP-019 | Validated ZUGFeRD PDF/A-3/CII and visible/embedded parity; safe mapping editor with draft/test/publish regression gate; deduplicated usage, agreed plans/entitlements and billing lifecycle; customer onboarding/offboarding and documentation                        | Hybrid fixtures independently verified; failed mapping tests block publication; payment/cancellation/retry scenarios preserve evidence and export access |
| 6. Launch acceptance                | FP-018–020         | Production capacity/load and disaster-recovery tests; external security review/remediation; customer UAT; incident/support procedures; reviewed legal/privacy/subprocessor/retention terms; launch rehearsal and owner decision                                       | Original development plan §12 checklist has evidence for every applicable item; no unresolved critical/high launch issue; founder records go/no-go       |

Stages are dependency groups, not calendar promises. Split each into reviewable changes with migrations, API contracts, bilingual UI where applicable, focused tests and recorded acceptance. Preserve the existing successful invoice workflows throughout. Stage 2 baseline work can proceed alongside stage 1; transport cannot be enabled before its own gates pass. Credit-note semantics must be ready before automating corrections to issued invoices. Pilot delivery may remain download/API-only if that is the explicitly agreed route.

## First implementation increment

**Completed first increment: membership authorization foundation (stage 1), 15 September 2026.** Implemented and verified with 101 tests; see TEAM_ACCESS.md and RELEASE_A_RESULTS.md. The implementation replaces authority supplied by local token configuration with an active membership read from PostgreSQL on every authenticated request. It adds administrator-only team inspection and role/status changes, optimistic concurrency, immutable audit events and serialized last-active-administrator protection. Team controls are available in the existing English/German interface.

This increment does not create production sign-in or email invitations. It supplies the authorization boundary that an OIDC identity will use. Local tokens identify a tenant and subject; their configured role must not grant authority. Existing users remain usable through explicit local membership records.

Next increments within stage 1:

1. Auth0 EU recommendation is recorded; owner review, plan/MFA/privacy checks and live-provider acceptance remain pending.
2. Configurable OIDC sign-in, app logout, secure sessions and expiry are implemented and pass isolated-issuer/browser tests. Application authorization remains in membership records. Accept the configured live provider before production use.
3. Implement verified invitations, organization setup and tenant selection. Bind subjects to the verified issuer/subject pair; never link accounts solely by an unverified email address.
4. Implement scoped API credentials with one-time secret display, hash-only persistence, expiry/rotation/revocation and environment separation.
5. Add explicitly authorized, time-bound support access and finish onboarding/offboarding acceptance.

## Decisions and external inputs

- The owner has no preferred sign-in provider; a recommendation is requested before selecting one.
- Hosting, private storage, email and billing providers remain recommendations/decisions, not silently purchased services.
- Product/domain review must establish supported tax and issued-correction cases with fixtures.
- Customer supplies an authorized export, authoritative recipient instructions, archive expectations and pilot approval.
- Retention durations, prices/billable units, RPO/RTO and legal terms require recorded decisions; do not invent values to mark a milestone complete.

Provider-independent engineering should continue while decisions are pending. Ask for decisions only when a concrete choice blocks the dependent implementation or deployment.

## Progress accounting

Current evidence: 108 passing automated tests, the 28-operation contract, production build and local recovery acceptance. Stage 1 now includes the configurable OIDC adapter and seven isolated identity checks, including Chromium and WebKit sign-in/logout. Live-provider identity acceptance remains open. Completed: the local JSON/CSV → correction → validation → approval → XRechnung/evidence workflow, versioned recipient requirements, self-assigned review queue, bilingual appearance and local snapshot/restore tooling. Partial: original FP-003/004/008–011/018–020. Not yet delivered: email, webhooks, credit notes, ZUGFeRD, visual mapping editor, billing and production launch.

SFTP, Peppol, multi-entity/partner console, assisted PDF conversion, manual authoring and additional countries remain conditional extensions. They are not silently added to the core v1 completion gate.

Sources: original Development Plan §§3, 9–12; Product Requirements and Release Acceptance; Authoritative Technical Contracts; Operations Security and Delivery Runbook; SUPPORT_MATRIX.md; TBD.md; RELEASE_A_RESULTS.md.

## OIDC continuation — 15 September 2026

The next identity increment adds configurable OIDC sign-in, issuer/subject-bound memberships, secure opaque sessions, app logout, immediate membership enforcement and bilingual sign-in UI. See [identity operations](IDENTITY.md) and [the Auth0 recommendation](reviews/2026-09-15-identity-provider.md). Isolated issuer and browser verification are recorded separately from live provider acceptance.

Next implementation: verified invitations, organization setup and explicit tenant selection. Scoped API credentials and support grants follow. Provider selection/configuration, MFA and recovery acceptance remain open; no live provider account or production deployment was created.
