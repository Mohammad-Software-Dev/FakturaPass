# Validator image security

Run `npm run release:validator` from a clean committed checkout with Node 22, installed npm dependencies, Docker and unzip. Setup verifies the official KoSIT separate-library ZIP and the rule configuration, then verifies every ZIP member against `distribution.lock.json`. It rejects unexpected archive entries and recreates only its generated distribution directory so obsolete libraries cannot remain on the wildcard classpath. Local and container launchers use the upstream main class with the same library set. The validator version and invoice rules remain unchanged.

The release command builds a revision-labeled image, verifies every installed distribution file checksum and scans its immutable ID. Evidence under `.data/releases/validator-<revision>-<timestamp>/` includes image metadata, pinned inputs, per-library entries/POMs/manifests/notices, native/SPDX inventories, vulnerability/license reports, OS packages and coverage results. A final manifest requires all three gates to pass. CI retains failed evidence independently for 30 days. No image is deployed or published by this command.

## Coverage and review boundaries

The validator profile requires supported OS packages and a versioned validator JAR under `/engine/distribution/`. Every pinned distribution JAR must have an inventory component at its exact installed path with the expected version. This closes the original shaded-library omissions while still detecting scanner version mistakes. Unknown embedded code, configuration assets and native/JRE distribution obligations require separate review. A passing vulnerability scan cannot override blocked coverage or licenses.

Java license review includes library and JRE archives without a first-party exemption. Exact declarations remain authoritative; missing or unfamiliar expressions require review. The exact URL `https://opensource.org/license/mit` is normalized to MIT because [OSI identifies it with that SPDX identifier](https://opensource.org/license/mit). Reports retain both the original value and canonical identifier. Lookalikes and arbitrary URLs remain blocked, and the policy must still allow MIT.

To test the exact recorded validator with application images, set `VALIDATOR_IMAGE=sha256:<image-id>` along with `WEB_IMAGE` and `WORKER_IMAGE`, then run `npm run test:containers`. The override accepts only an immutable ID and skips rebuilding the validator. Without it, the existing local-build behavior remains. Tests use disposable database/network resources.

## Earlier shaded-JAR results — 12 October 2026

Initial source `81067637a6c9fcd7b0c31f4bc004f65bd4740556` produced 134 inventoried packages and 22 blocking vulnerability matches (2 Critical, 17 High, 3 Unknown). Most originated in the inherited, unused `/usr/bin/pebble` supervisor. The executable was not owned by a Debian package and Java starts directly, so it was removed in full. The intermediate scan then retained only three High OpenSSL matches.

The final image pins official Temurin 25 JRE to index digest `sha256:fcd7fd7b387f94bb2ac461478a7436ad8e349924c374ea8313919624dceae636`. It reports Java 25.0.4.1 and OpenSSL packages `3.5.5-1ubuntu3.7`. The pinned validator 1.6.3 and rule configuration are unchanged. The [official validator release list](https://github.com/itplr-kosit/validator/releases) still identifies 1.6.3 as latest at this review.

Final source: `3bcfbd6b259d614289aef4f06cb706e26448d69b`. Image: `sha256:e43be69391049b160b738974e3621eefcd4f16a910ded6bbc9a084ce95bf2bd2`. Evidence: `.data/releases/validator-3bcfbd6b259d614289aef4f06cb706e26448d69b-1791811372291/`. Linux ARM64 only. The 121-package inventory passes the vulnerability gate using database `2026-10-12T06:45:22Z`: no blocking matches, 113 Medium and 6 Low matches retained. No exception or suppression was added.

Thirteen Java license reviews remain: Angus activation, Commons IO/Lang, istack, Jakarta activation/bind, Jansi, JAXB core/runtime, JRE jrt-fs, SLF4J API/simple and txw2. Most have no detected declaration; Jansi and Jakarta activation have non-allowlisted textual declarations. Embedded notices give useful evidence but do not automatically resolve these findings.

Coverage remains blocked for Saxon-HE 12.9, picocli 4.7.7 and XML Resolver. The first two versions are declared by the embedded POM; XML Resolver classes are present without identified version metadata. These libraries are not covered by the raw scanner's package inventory. No final validator manifest was created.

The exact final validator passed all 20 Chromium/WebKit container journeys and official-validation checks with the previously accepted application image pair. Functional logs and immutable input IDs are retained alongside the blocked security evidence.

Next: establish complete shaded-library provenance and versions, assess a pinned upstream distribution retaining separate library metadata, retain appropriate notices, and repeat all gates. Changes to executable packaging or dependencies require official-validation regression tests. Then proceed to signed provenance and staging/rollback acceptance; local scan results alone do not authorize production promotion.

## Separate-library distribution — 12 October 2026

The official `validator-1.6.3.zip` digest is `95d5a399ff5186dae5ddb7edd9a14a9c8352610159a90bfa27d4739a8bc37822`, matched against the GitHub release asset digest. Its main JAR, 16 library/data JARs and LICENSE/NOTICE are individually pinned. Source `d3a0b4ded6e41273c2b6c2ad04acccb8735a25d1` produced image `sha256:22b0ca341127b7748be34508b34027954137eb01e2619026268e350491101212`. Evidence: `.data/releases/validator-d3a0b4ded6e41273c2b6c2ad04acccb8735a25d1-1791811814864/`.

The inventory now identifies all three previously omitted libraries. Its 125 packages include 18 Java components. The vulnerability gate still passes with the 12 October database: no High/Critical/Unknown matches, 113 Medium and 6 Low matches retained. The first license report had seven reviews; `validator-licenses-normalized.json` re-evaluates the same raw inventory at revision `30b6b479faf64afdebe0b2b5066382bd4ab2354a`, recording its image/inventory/policy hashes and the two exact MIT URL normalizations. Five reviews remain: Saxon-HE, JRE jrt-fs, picocli and both XML Resolver JARs.

One coverage discrepancy remains: Syft reports XML Resolver's data archive as version `5.3.3-data`, while the pinned JAR manifest declares `Implementation-Version: 5.3.3`. Both reports and the manifest evidence are retained. No package version has been rewritten or accepted as equivalent; coverage stays blocked pending a verified classifier/version treatment. No final release manifest was created.

All 20 browser/container journeys passed using this exact validator and the previously accepted application image pair. The package source changed the engine input fingerprint; rebuild matching application images from the same source before deployment. This compatibility test is not a new combined production release. Twenty-nine domain tests, 14 policy tests, contracts, lint, types and format checks passed. Isolated negative probes rejected mismatched archive locks, missing ZIP entries and incorrect per-file hashes, and confirmed obsolete libraries are removed.

Next: resolve the classifier discrepancy with evidence-preserving metadata handling and complete the five remaining license/notice reviews. Keep scan output and supplied notices intact. Then rebuild the complete release set and repeat security/functional gates before provenance signing and staging.
