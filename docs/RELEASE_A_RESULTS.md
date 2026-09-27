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

## Local recovery milestone — 15 September 2026

The complete acceptance run passed all 97 tests: 29 domain/localization tests, 10 integration tests, 6 API suites, 50 Chromium/WebKit browser tests and 2 recovery tests. Formatting, TypeScript, ESLint, the 23-operation contract, production build and dependency audit passed; zero vulnerabilities were reported.

Recovery acceptance uses the populated isolated database after browser workflows, including generated XML and evidence. It verifies full-table fingerprints after restore, retained recovery copies, restored immutability triggers, archive corruption rejection, record mismatch rejection, cleanup and local-target restrictions. A separate backup of the current local workspace was restored and verified successfully: 18 tables and 408 rows. The working database was preserved and the temporary restore removed.

This closes the local backup/recovery engineering step. Off-site encrypted backups, production-volume recovery timings, point-in-time recovery, production identities and an approved RPO/RTO remain open. See RECOVERY.md for the operator commands and limitations.

## Membership authorization foundation — 15 September 2026

The complete acceptance run passed 101 tests: 29 domain/localization tests, 11 integration tests, 7 API suites, 52 Chromium/WebKit browser tests and 2 recovery tests. Formatting, TypeScript, ESLint, the 25-operation API contract, production build and dependency audit passed; zero vulnerabilities were reported.

Coverage proves token-configured roles cannot override database memberships, suspended members lose access on their next request, cross-tenant changes fail, stale versions are rejected and concurrent administrator demotions preserve one active administrator. Browser tests exercise role changes, suspension/reactivation, German switching and mobile dark appearance. Recovery acceptance continues to verify the populated database, including membership versions and audit records. Migration 007 was applied to the local workspace.

This implements the first stage-1 increment in COMPLETION_PLAN.md. Team access manages existing local memberships; production sign-in, verified invitations, tenant switching, scoped API credentials and support grants remain open. No production identity provider has been selected or connected.

## Configurable OIDC sign-in — 15 September 2026

The final complete acceptance run passed 108 tests: 29 domain/localization tests, 11 database/validator integration tests, 7 API suites, 52 invoice browser tests, 7 OIDC tests (including Chromium and WebKit journeys) and 2 recovery tests. Formatting, TypeScript, ESLint, the 28-operation contract, production build and dependency audit passed; zero vulnerabilities were reported.

The OIDC checks verify signed-token validation, state/nonce/audience/expiry rejection, one-use callbacks, browser binding, hash-only sessions, logout, membership suspension, expired sessions, authority separation and rejection of ambiguous active tenants. Native sign-in forms exposed an Origin/referrer-policy conflict during browser acceptance; the final same-origin policy fixes it while authentication redirects retain no-referrer. Both browsers pass the corrected production build. The mobile dark sign-in screen was visually inspected.

Migration 008 adds identity tables to the local workspace; its 21 invoices were preserved. Backup recovery includes the new tables. See IDENTITY.md for session invalidation before a restored database is promoted.

This is provider-independent integration acceptance using an isolated synthetic issuer, not live Auth0 acceptance. Auth0 EU is recommended for review; no provider account, production MFA policy, deployment or paid service was configured. Verified invitations, organization setup, tenant selection, scoped API credentials and support access remain next in stage 1.

## Explicit workspace selection — 21 September 2026

Acceptance covers 109 tests: 29 domain/localization tests, 11 database/validator integration tests, 7 API suites, 52 invoice browser tests, 8 OIDC/workspace tests and 2 recovery tests. Formatting, TypeScript, ESLint, the 29-operation contract, production build and dependency audit pass; zero vulnerabilities were reported.

The first browser regression pass completed all 52 workflows. A later full run encountered long stalls and timeouts in two WebKit cases (dark-mode invoice workflow and review queue); 50 other cases passed. A targeted rerun on a fresh database passed both affected workflows plus the other dark-mode cases (4 tests), all 8 identity/workspace checks and both recovery checks. No application change was needed for those two timeouts. The new multi-tab harness was corrected to use an explicit shared browser context before acceptance.

Workspace coverage includes a chooser for multiple active memberships, explicit request/download selectors, missing/conflicting/repeated selector rejection, organization-specific roles, zero-active-membership state and suspension while another workspace stays available. Chromium and WebKit open two workspaces in related tabs, make a real membership edit in the original tab after switching the second tab, and verify that only the original workspace changes. They also verify suspended-workspace removal and logout. The mobile dark chooser was visually inspected.

Migration 009 was applied to the local workspace, which retains all 21 invoices. This closes workspace selection within stage 1. Organization creation, verified invitations, scoped API credentials, support grants and live-provider acceptance remain open.

## Organization bootstrap and verified invitations — 21 September 2026

The complete verification run passed 113 tests: 29 domain/localization tests, 11 database/validator integration tests, 7 API suites, 52 invoice browser tests, 12 identity/onboarding tests and 2 recovery tests. Formatting, TypeScript, ESLint, the 34-operation contract, production build and dependency audit passed; zero vulnerabilities were reported.

New coverage verifies atomic organization bootstrap and duplicate-ID rejection; administrator-only invitation creation; token-hash persistence and one-time disclosure; replacement, expiry, revocation and authority separation; signed, matching, boolean-verified email claims; one successful grant under concurrent callbacks; rejection after inviter demotion; preservation of existing roles; and refusal to reactivate suspended members. Chromium and WebKit exercise administrator link creation, a separate recipient browser context, removal of the secret URL fragment, provider sign-in, assigned read-only access and accepted status in the administrator's refreshed list. The mobile dark invitation page was visually inspected.

Migration 010 was applied locally and all 21 existing invoices were preserved. Recovery verification includes organization invitations and login-transaction bindings. Pending invitation links must be revoked before a restored database is promoted; see RECOVERY.md.

Organization setup is operator-assisted and invitation links are shared manually. No emails were sent and no provider account or production deployment was created. Live provider claim/MFA/recovery acceptance, automated email delivery, self-service/commercial onboarding, scoped API credentials and support grants remain open.

## Scoped API credentials — 21 September 2026

The complete final verification run passed 117 tests: 29 domain/localization tests, 11 database/validator integration tests, 7 API suites, 52 invoice browser tests, 16 identity/onboarding/credential tests and 2 recovery tests. Formatting, TypeScript, ESLint, the 38-operation contract, production build and dependency audit passed; zero vulnerabilities were reported.

Credential coverage verifies hash-only storage and one-time secret responses, explicit operation scope checks, rejection of access administration and unknown endpoints, no invalid-key fallback to browser sessions, workspace isolation, current owner role and suspension enforcement, expiry and authority/environment binding, admitted-use auditing and last-use timestamps, atomic rotation under concurrent requests, stale-version rejection and revocation. Machine credentials import invoices without a browser Origin, preserve idempotent replay and cannot read another workspace's invoice. Chromium and WebKit exercise creation, replacement and revocation through the mobile dark Team interface; its layout was visually inspected with the secret hidden.

An initial full run passed all 52 invoice browser cases but exposed a setup error in the new cross-workspace test: its second membership remained suspended from an earlier case. The fixture now explicitly activates and later restores that membership, and checks credential creation before use. The final complete run passed with this correction.

Migration 011 was applied locally; all 21 existing invoices remain and the app reports ready. Recovery acceptance includes the credential table. Operators must revoke restored credentials before cutover to prevent a backup from reviving a subsequently rotated or revoked secret. The usage guide includes the integration lifecycle story.

Credential management requires configured OIDC administrator sign-in; the ordinary local development identity does not expose these controls. No live identity provider, production MFA policy, deployment or paid service was configured. Next stage-1 work is explicitly authorized, time-bound support grants and remaining onboarding/offboarding acceptance.

## Explicit support diagnosis — 21 September 2026

The complete verification run passed 121 tests: 29 domain/localization tests, 11 database/validator integration tests, 7 API suites, 52 invoice browser tests, 20 identity/onboarding/support tests and 2 recovery tests. Formatting, TypeScript, ESLint, the 44-operation contract, production build and dependency audit passed; zero vulnerabilities were reported.

New backend checks verify that specialist registration grants no access, customer consent is required, grants bind a tenant and exact revision, support-only sign-in creates no membership, normal workspace/file/mutation endpoints stay inaccessible, another actor cannot use a grant, later corrections stay private and views record the specialist's own subject. Expiry, revocation, authorizer demotion, environment changes and a suspended customer identity deny subsequent reads. Specialist offboarding revokes all grants; registry audit events reject deletion. Concurrent diagnostic reads complete successfully.

Chromium and WebKit exercise customer selection and explicit consent, separate specialist sign-in, invoice review and a saved diagnostic's affected field/rule/technical details, German/English switching, last-viewed history and closure after revocation. Initial focused browser tests exposed ambiguous accessible names on the new selection controls and test-state leakage following a failed browser case. The final controls have explicit accessible names and each browser starts with isolated membership state. All 20 focused checks and the final full suite pass. The mobile dark support screen was visually inspected.

Migration 012 was applied to the local workspace. All 21 existing invoices remain, the application reports ready and no real specialists or grants were created. Recovery verification includes the specialist registry, immutable registry events and support grants. Before recovery cutover, revoke restored grants and reconcile the personnel registry; see RECOVERY.md.

Local stage-1 identity/support behavior and the onboarding/offboarding operations checklist are implemented. Live-provider claims/MFA/recovery acceptance, approved support personnel/processes and production security/capacity acceptance remain open. No provider account, external message, deployment or paid service was created. The next engineering increment is stage-2 observability and deployment readiness.

## Operational monitoring baseline — 22 September 2026

The complete verification run passed 128 tests: 29 domain/localization tests, 11 database/validator integration tests, 7 API suites, 7 operations tests, 52 invoice browser tests, 20 identity/onboarding/support tests and 2 recovery tests. Formatting, TypeScript, ESLint, the 45-operation contract, production build and dependency audit passed; zero vulnerabilities were reported.

Operations coverage verifies the disabled-by-default endpoint, dedicated secret and rejection of customer credentials, no-store responses, schema-valid degraded snapshots, bounded request metric cardinality and omission of private path data. It exercises missing/stale workers, delayed queues and retries, expired leases, validator outage, environment-isolated job claims, distinct rejection/retry/recovery accounting, real worker startup/shutdown and bounded database lock failure. Durable metrics commit with business outcomes. Recovery acceptance includes the new tables.

A related support-screen correction maps persisted PASS/FAIL validation results to localized customer-facing labels. The synthetic fixture now uses the real saved status, and Chromium/WebKit assert the English label alongside the existing support journey.

Migration 013 was applied through a coordinated local stack restart. All 21 existing invoices remain. Readiness returns 200; the operator health command reports healthy with one active LOCAL worker, no queued jobs and no alerts. The HTTP operations endpoint remains disabled (404) because no operations secret was configured. Request logging remains opt-in.

This closes the provider-independent observability increment, not production monitoring acceptance. No collector, paging destination, production deployment or paid service was configured. Next: reproducible deployment images, software bill of materials and retained release evidence, followed by the remaining stage 2 acceptance gates in COMPLETION_PLAN.md.

## Application images and release evidence — 22 September 2026

The final complete verification run passed 129 tests: 29 domain/localization tests, 11 database/validator integration tests, 7 API suites, 8 operations tests, 52 Chromium/WebKit invoice workflows, 20 identity/onboarding/support checks and 2 recovery tests. Formatting, TypeScript, ESLint, the 45-operation contract, production build and npm audit passed; zero npm vulnerabilities were reported.

An earlier run passed 48 browser workflows before the local PostgreSQL container exited unexpectedly (recorded exit code 139). Four remaining workflows failed while the database was unavailable. The container's persistent volume retained all 21 local invoices. The outage exposed unhandled idle-pool errors in the application; these now emit only a stable DATABASE_UNAVAILABLE code, and a regression test terminates a real idle connection and verifies reconnection without a process crash. PostgreSQL and the app were restored, the abandoned verification database was removed, and the final complete suite passed. The underlying container exit cause is not established.

Container acceptance passed separately, then passed again through `npm run release:images` against the exact image IDs built from clean revision `867a9aea695f00485b79b1eb5bc724d097620d02`. The locally accepted images target Linux arm64; other deployment platforms require their own acceptance. Acceptance checks UID/GID 10001, read-only runtime operation, absence of local secrets/data and development tooling, usable production npm SBOMs, rejection of missing/incompatible configuration, explicit migrations, web readiness, synthetic import and official validation, durable job metrics and graceful heartbeat removal. Temporary PostgreSQL and validator containers run on a dedicated test network; only the test web port is exposed on loopback and all test resources are removed afterward. Initial packaging checks corrected missing build-time synthetic example inputs, SBOM generation order and an internal-network test port restriction.

The retained local bundle is `.data/releases/867a9aea695f00485b79b1eb5bc724d097620d02-1790089954664/`. Its final manifest ties the image IDs/platforms to source, lockfile and validator-manifest hashes. It includes the successful verification log, container acceptance output, BuildKit metadata, npm CycloneDX SBOMs, license declarations, Debian package inventories and npm audit. Every listed evidence-file checksum was independently verified after creation. CI now generates and retains this evidence after application verification; local acceptance does not assert that the pushed CI run has completed.

The original application reports ready and operationally healthy with one worker and no queue alerts; all 21 invoices remain. No image was published to a registry and no production service was deployed. Full-image CVE scanning, license-policy approval, signed registry provenance, approved staging configuration and deployment/rollback rehearsal remain the next stage 2 gates. See DEPLOYMENT_IMAGES.md and ADR 0019.

## Release security gates and runtime remediation — 27 September 2026

The complete application verification passed 137 tests: the previous 129 application, browser, identity, operations and recovery checks plus 8 release-security policy tests. Formatting, types, lint, the 45-operation contract, production build and application npm audit passed. The audit reported zero vulnerabilities in its scope. Verification used an isolated temporary database; all 21 existing local invoices remain. The retained verification log is `/private/tmp/fp-security-verify.log`, also copied into the release evidence below.

Full-image scanning now runs with checksum-pinned Syft 1.52.0 and Grype 0.119.0. The refreshed vulnerability database was built on 26 September 2026. The existing web image contained 497 inventoried packages and 87 blocking advisory/package matches. Eleven blocking npm matches came from the base image's global npm installation. Removing npm, Corepack and Yarn from runtime stages reduced the inventory to 299 packages and eliminated those eleven matches; build stages retain their required package managers.

Both rebuilt Linux ARM64 images from revision `2d7c369c60bd43d0f8d89bbe98174677beac48ca` were scanned through `npm run release:images`. Each retains 76 blocking Debian advisory/package matches: 53 High, 7 Critical and 16 Unknown. These are scanner matches, not 76 independently demonstrated application exploits or unique advisories. Findings include glibc, Perl, util-linux, ncurses and zlib; many have no fix listed for the current Debian package version. No suppression or exception was added. Three npm license declarations involving Sharp/libvips require review in each image; optional platform packages and actual shipped notices must be assessed before resolving that gate.

Evidence is retained at `.data/releases/2d7c369c60bd43d0f8d89bbe98174677beac48ca-1790462611540/`, including image/build metadata, native and SPDX image SBOMs, raw vulnerability matches, evaluated policy reports, npm inventories/license results and the verification log. Web image ID: `sha256:a8dc24a668f9d7d0e6702ed810f4b4e7f33b8123e8aadf01136bda9a7d70f763`. Worker image ID: `sha256:535a8278062ab048ebe7ba1b7bbfc345c176542d96a757f85e9ede1bf795d367`. The release command correctly exited nonzero and did not create `manifest.json`. This is blocked-release evidence, not an accepted release.

Separate container acceptance passed against those exact rebuilt IDs: migrations, non-root/read-only execution, absence of package managers, web readiness, invoice import and official validation, metrics and graceful worker shutdown. The acceptance log is retained alongside the blocked-release evidence as `container-remediation-acceptance.log`. Passing runtime behavior does not override the security gate.

The engineering gate is implemented; security acceptance remains open. Next: remediate the Debian base, resolve distribution/license obligations, and apply equivalent acceptance to the separate validator image before signed registry publication and approved staging deployment. No production deployment or registry publication occurred. See SECURITY_RELEASE.md and ADR 0020.

## Debian 13 and installed-package license acceptance — 27 September 2026

Updated the application base to official Node 22.23.3 on Debian 13, pinned to index digest `sha256:b26b04c123d9ff8ab646ceb18b9d75a1173acf64b9a401094b906d27b29338d4`. Build dependencies remain complete; production dependencies omit development and optional packages. Sharp/libvips are absent from the resulting filesystem. The unused Next.js image optimizer is explicitly disabled and its endpoint returns 404 in container acceptance.

An initial scan failed because temporary layer extraction exhausted local disk. Only unused project build cache was reclaimed (about 2.3 GB); invoice data, backups, existing images and reports were retained. The failure produced SCAN_UNAVAILABLE and no release approval. Subsequent complete scans succeeded.

The npm dependency-graph SBOM still listed the omitted `@img/sharp-wasm32` package. Filesystem inspection confirmed it was absent. The release license gate now uses installed npm packages from Syft, including bundled dependencies, with only the exact first-party root reported separately. This removes the false installed-package finding and exposes four previously unreviewed declarations: `@vercel/og` (MPL-2.0), `babel-packages` and `constants-browserify` (missing declarations), and bundled `tar` (BlueOak-1.0.0). These require review; no license allowlist relaxation was made. The raw dependency-graph SBOM remains available for comparison.

Both final Linux ARM64 images built from `9fed649d3ef937141a298da0e3944c26882970f5` contain 274 inventoried packages and report 48 High vulnerability matches, 48 Medium, 44 Negligible and 8 Low. Critical and Unknown matches are zero, down from 7 and 16 respectively in the previous images. The 48 remaining blockers are Debian package/advisory matches, including glibc, util-linux, Perl, ncurses, zlib and libacl; they remain blocked even where no fix is listed. No exception or suppression was introduced.

Evidence directory: `.data/releases/9fed649d3ef937141a298da0e3944c26882970f5-1790463990461/`. Web image: `sha256:86937425351988598b733b5b833e5d0e1f8e70e8cc96234eab4db726bb10282d`. Worker image: `sha256:974496ebbc4a2e321f69b92ba94f7209303d3d827563ff9fc9573af6ab8c3759`. Both vulnerability and license gates correctly block promotion; no final manifest exists.

Nine security-policy tests passed, including coverage for bundled packages and narrowly identified first-party code. Type checking, lint, formatting and the production image build passed. Separate container acceptance passed against the exact final IDs: package-manager and Sharp absence, disabled image optimizer, non-root/read-only operation, configuration rejection, migration, readiness, synthetic import and official validation, metrics and graceful shutdown. Its log is retained as `container-remediation-acceptance.log` alongside the blocked-release reports. This focused runtime increment did not repeat the complete 137-test application suite from the preceding increment.

Next: reduce or remediate the remaining OS footprint and review the four installed bundled dependencies, then validate the separate invoice-engine image. Registry signing, staging and production acceptance remain open.

## Minimal runtime vulnerability gate — 27 September 2026

Both application image vulnerability gates now pass on Linux ARM64: zero High, Critical or Unknown matches, with two Medium BusyBox matches retained. Each final image contains 206 inventoried packages. The vulnerability database was built on 26 September 2026 and passed the 120-hour freshness check. No exception, suppression or severity-policy change was introduced.

The runtime uses official Node 22.23.3 Alpine 3.24 pinned at `sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402`; Debian 13 remains the build environment. A build guard rejects native `.node` add-ons. An initial Alpine scan reduced 48 High findings to one system-zlib match. Dependency and linker inspection showed only APK/libapk needed that installed zlib; Node links to musl/libstdc++/libgcc and reports bundled zlib `1.3.1-e00f703`. APK, libapk and system zlib were then removed through APK, with the installed-package database updated normally. OS evidence now uses structured JSON from the same scanned filesystem and supports Debian/Ubuntu and Alpine inventories.

Final image source revision: `7056816e4451859faaafdc24e8aa4867706be3bb`. Evidence directory: `.data/releases/7056816e4451859faaafdc24e8aa4867706be3bb-1790515523014/`. Web image: `sha256:c94fdcffed3b5718acb3186c3448df118f12a0fc6620d0e1054e4ce77d566ff8`. Worker image: `sha256:eb68bf7fe2025ddba5c4b9ae6a4e645703a45937639c0c99c5ee52ae2b1a5ce4`.

The release command still exits nonzero because four installed Next.js bundle license reviews remain open; no final manifest was created. `license-review-evidence.json` retains the exact final image identity, Node/Next/zlib versions, package declarations, available LICENSE texts, missing-file records and SHA-256 hashes. See DEPENDENCY_LICENSE_REVIEW.md. This is vulnerability-gate acceptance, not production release acceptance.

Initial image extraction ran out of local disk; those attempts recorded SCAN_UNAVAILABLE and produced no approval. Obsolete project-only exploratory candidates and their unused build cache were removed; the original packaging pair, current Debian fallback pair, all reports, invoice data and backups were retained. Successful final scans completed afterward. Scanning/building needs more free temporary space than the final image size alone suggests.

Ten policy tests, type checking, lint and formatting passed. Production image builds passed. The expanded container acceptance runs 20 Chromium/WebKit journeys against the actual images, covering all three customer examples through preview, correction, duplicate recovery and export, plus mobile validation, language/error recovery and both themes. Early runs passed all 20 browser cases but exposed two harness issues: a synchronous browser subprocess left a stale idle HTTP socket, and an old single-job metrics assertion did not account for the extra browser-created invoices. Browser execution is now asynchronous; exact single-job metrics are checked before the browser workload, with cumulative metrics checked after it. These changes do not modify application behavior. Final exact-image acceptance then passed completely, including all 20 browser journeys, package-manager/Sharp/system-zlib absence, Node compression, migration, official validation, metrics and graceful shutdown. The successful log is retained as `container-acceptance.log`; the earlier harness-failure logs are retained separately.

Platform-specific acceptance remains required. In particular, upstream's AMD64 musl support classification and production runtime choice must be reviewed before deployment; this ARM64 result does not approve another architecture. No registry image was published or production service deployed. See ADR 0021.
