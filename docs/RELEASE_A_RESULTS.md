# Release A acceptance results

Verified locally on 13 September 2026. The six implementation-plan stages are complete for the Release A scope selected by the supplied START HERE document.

## Delivered behavior

The German and English workspace supports canonical JSON preview/import, schema and decimal checks, official XRechnung validation, recipient-profile findings, immutable correction history, approval, deterministic UBL generation, and authenticated XML/evidence downloads. All 15 REST operations, PostgreSQL persistence, leased background jobs and explicit migrations are implemented. No official validation result is simulated.

## Executed checks

| Check                                                    | Result                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| Formatting, strict TypeScript and ESLint                 | Passed                                                      |
| Domain and localization tests                            | 17 passed                                                   |
| Database and real official-validator integration tests   | 7 passed                                                    |
| API suites, including actual OpenAPI response validation | 3 passed                                                    |
| OpenAPI 3.1 contract                                     | 15 operations verified                                      |
| Next.js optimized production build                       | Passed                                                      |
| Chromium browser workflows                               | 16 passed                                                   |
| WebKit browser workflows                                 | 16 passed                                                   |
| Dependency audit                                         | 0 vulnerabilities reported                                  |
| Pinned Docker validator smoke test                       | Golden FP-A-001 accepted by EN16931 XRechnung (UBL Invoice) |

Run `npm run verify` to reproduce the application checks. It creates and removes a separate test database and tests a production server on port 3011. The Docker engine smoke test additionally used the pinned image on port 8090 and the same adapter, including submitted XML/report hash verification. CI configuration is provided; remote GitHub Actions execution has not been claimed.

Coverage includes concurrent/idempotent ingestion, changed-body conflicts, immutable source/revisions/results, tenant isolation, role authorization, stale approvals, payload boundaries, loopback Origin checks, expired leases, engine failure and recovery, golden XML bytes, monetary errors, unsupported cases, missing schema fields, correction history, and downloadable XML/evidence. Browser checks exercised the complete successful workflow and negative input in both engines, with schema feedback at a mobile viewport.

## Specification decisions and limits

The original FP-A-001 omits the mandatory seller telephone and remains a negative fixture. The positive synthetic fixture supplies that value explicitly. Official successful reports retain informational BR-DE-TMP-32; no service date is invented. Reduced VAT remains PENDING_SUPPORT, and unsupported tax cases are blocked.

This is a completed local Release A demonstrator for synthetic data. It is not a production deployment. Production identity, customer mappings, verified recipient requirements, delivery, billing, legal terms, operational guarantees and broader invoice formats remain the explicit B/C gates in TBD.md and the support matrix.

See README.md for startup, IMPLEMENTATION_PLAN.md for the plan, OPERATIONS.md for recovery, and adr/0009-release-a-implementation.md for decisions.

## German and English language release

The complete verification command passed after introducing language support: 16 domain/localization tests, 7 integration tests, 3 API suites and 20 browser tests (46 total). The production build, formatting, TypeScript, ESLint and dependency audit passed; the audit reported zero vulnerabilities.

Coverage includes full successful and negative workflows in both languages, persistent switching without losing drafts, server-rendered language and metadata, localized number/date formatting, schema/API errors, mobile layout, missing pages and unexpected-error recovery. API checks confirm that changing language preserves generated XML hashes and saved evidence. See INTERNATIONALIZATION.md for catalog structure and adding languages.

## Light and dark appearance release

The full verification passed with 56 tests: 16 domain/localization tests, 7 database/validator integration tests, 3 API suites and 30 Chromium/WebKit browser tests. Formatting, strict TypeScript, lint, production build and dependency audit passed; the audit reported zero vulnerabilities.

Added dark-mode end-to-end workflows, persistent server-rendered theme checks, language/draft preservation, actual file upload, mobile sizing, reduced-motion checks and representative text contrast checks at 4.5:1 or better. Desktop and mobile screenshots in both themes were visually reviewed. This is not a claim of a full external accessibility audit. See APPEARANCE.md and USER_GUIDE.md.

## Customer workspace refinement

The blue light and dark themes and customer-facing workflow passed all 59 tests: 17 domain/localization tests, 7 integration tests, 3 API suites and 32 browser tests. The optimized build, formatting, strict TypeScript, ESLint and dependency audit passed. Customer-flow checks cover a clean empty state, one primary import action, optional format examples and collapsed technical information. Demo branding has been removed from the interface; existing invoice records and immutable evidence remain unchanged. The usage guide now follows realistic customer journeys through preparation, correction, reference checks and export.

## Invoice review and correction improvements

The final acceptance run passed all 70 checks: 20 domain/localization tests, 7 database/official-validator integration tests, 3 API suites and 40 Chromium/WebKit browser tests. Formatting, strict TypeScript, ESLint, the production build and dependency audit passed; zero vulnerabilities were reported.

The three customer examples each passed import, complete preview, cancellation, correction, duplicate recovery, approval, official validation and XML download. Additional coverage verifies explicit decimal recalculation, inline schema errors, form/JSON synchronization, translation coverage, mobile layout and dark-mode rendering. The original invoice files and existing stored evidence were preserved. See reviews/2026-09-13-import-ux.md for the findings and their resolution.

## CSV pilot preparation — 14 September 2026

The final isolated-database acceptance run passed all 80 tests: 24 domain/localization/CSV tests, 8 database/official-validator integration tests, 4 API suites and 44 Chromium/WebKit browser tests. Formatting, strict TypeScript, ESLint, the 18-operation OpenAPI contract, production build and dependency audit passed; zero vulnerabilities were reported.

CSV coverage includes grouped invoice previews, explicit decimal parsing, header drift, source-row conflicts, quote and BOM handling, limits, tenant isolation, role checks, preview hash binding, idempotent batch saving, duplicate recovery, immutable recipe versions and original CSV/mapping evidence. Browser checks cover import through official validation, actionable malformed-export errors, German retranslation and mobile dark mode. The sample preview was also inspected in the running app in light and dark appearance.

This completes the local FP-008 engineering slice using synthetic fixtures. A real customer export mapping and controlled pilot acceptance remain open. See CSV_IMPORT.md and the next milestones in IMPLEMENTATION_PLAN.md.

## Recipient profile milestone — 14 September 2026

The final isolated-database acceptance run passed all 89 tests: 27 domain/localization/CSV/recipient tests, 9 database/official-validator integration tests, 5 API suites and 48 Chromium/WebKit browser tests. Formatting, strict TypeScript, ESLint, the 21-operation OpenAPI contract, production build and dependency audit passed; zero vulnerabilities were reported.

Coverage includes tenant isolation and administrator-only publication, immutable versions and history, optimistic concurrency, review evidence, expiry/effective dates, recipient identity and output-route matching, required-field pass/fail/unknown outcomes, stale approval/generation rejection and preservation of historical evidence. A valid evidenced profile is exercised through official validation and XML generation. Browser checks cover creating an unverified profile, publishing a reviewed version with explicit evidence and attestation, source-linked invoice findings, German switching and mobile dark mode. The recipient cards and form were also visually inspected in the running app.

This completes the local FP-009 engineering milestone. Real recipient evidence review, production identity/operations and controlled-pilot acceptance remain open. See RECIPIENT_PROFILES.md and reviews/2026-09-14-plan-comparison.md. The next independent engineering milestone is the FP-010 review queue.

## Review queue milestone — 15 September 2026

The final isolated-database acceptance run passed all 95 tests: 29 domain/localization/CSV/recipient/review tests, 10 database/official-validator integration tests, 6 API suites and 50 Chromium/WebKit browser tests. Formatting, strict TypeScript, ESLint, the 23-operation OpenAPI contract, production build and dependency audit passed; zero vulnerabilities were reported.

Coverage includes derived task resolution, expired recipient evidence, processing errors, concurrent ownership claims, stale revision/version conflicts, tenant isolation, role enforcement, server-derived ownership and audit records. Browser checks exercise import, assignment, ownership filters, German switching, mobile dark appearance, validation, approval, XML generation and removal from the queue. The running local queue was also visually checked in light and dark appearance. Migration 006 was applied locally while preserving existing invoices.

This completes the local FP-010 review queue milestone. Production identity and tenant administration, operational readiness and real customer pilot acceptance remain open. See REVIEW_QUEUE.md, USER_GUIDE.md and IMPLEMENTATION_PLAN.md for behavior and the next development steps.
