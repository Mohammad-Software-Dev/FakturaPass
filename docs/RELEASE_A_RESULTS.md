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
