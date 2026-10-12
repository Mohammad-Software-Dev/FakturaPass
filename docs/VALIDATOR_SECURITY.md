# Validator image security

Run `npm run release:validator` from a clean committed checkout with Node 22, installed npm dependencies, Docker and unzip. It verifies the pinned KoSIT executable/configuration downloads, builds a revision-labeled validator image, verifies the installed executable checksum and scans its immutable image ID. It does not deploy or publish an image.

Evidence is retained under `.data/releases/validator-<revision>-<timestamp>/`: image metadata, pinned inputs, JAR entry listing, embedded Maven POM, available license/notice text and hashes, native/SPDX inventories, vulnerability findings, Java license reviews, OS packages and coverage findings. A final manifest is written only if all three gates pass. An incomplete evidence directory is not approval. CI has an independent validator-security job and retains even failed evidence for 30 days.

## Coverage and review boundaries

The validator profile requires supported OS packages and the Java validator at `/engine/validator.jar`. It preserves the existing npm-required application profile. Java license review includes shaded libraries and the JRE archive, without a first-party exemption. Missing declarations and unfamiliar expressions require review under the unchanged exact-expression policy.

An independent coverage check compares the pinned executable's non-test Maven dependencies and declared versions with Java components located inside that executable. Optional runtime dependencies are included. An XML Resolver class marker also requires inventory coverage because that shaded library lacks its own Maven declaration in the JAR. This checks known omissions; it is not proof of exhaustive transitive coverage. A passing vulnerability scan cannot override a blocked coverage report. The original executable and scan output are never relabeled or edited to claim missing versions or licenses.

Configuration/rule assets, native/JRE distribution obligations and functional acceptance remain separate requirements. `validator-notices.json` retains available executable notices but does not decide their sufficiency. Unknown license information is a review requirement, not proof of a license violation.

To test the exact recorded validator with application images, set `VALIDATOR_IMAGE=sha256:<image-id>` along with `WEB_IMAGE` and `WORKER_IMAGE`, then run `npm run test:containers`. The override accepts only an immutable ID and skips rebuilding the validator. Without it, the existing local-build behavior remains. Tests use disposable database/network resources.

## 12 October 2026 results

Initial source `81067637a6c9fcd7b0c31f4bc004f65bd4740556` produced 134 inventoried packages and 22 blocking vulnerability matches (2 Critical, 17 High, 3 Unknown). Most originated in the inherited, unused `/usr/bin/pebble` supervisor. The executable was not owned by a Debian package and Java starts directly, so it was removed in full. The intermediate scan then retained only three High OpenSSL matches.

The final image pins official Temurin 25 JRE to index digest `sha256:fcd7fd7b387f94bb2ac461478a7436ad8e349924c374ea8313919624dceae636`. It reports Java 25.0.4.1 and OpenSSL packages `3.5.5-1ubuntu3.7`. The pinned validator 1.6.3 and rule configuration are unchanged. The [official validator release list](https://github.com/itplr-kosit/validator/releases) still identifies 1.6.3 as latest at this review.

Final source: `3bcfbd6b259d614289aef4f06cb706e26448d69b`. Image: `sha256:e43be69391049b160b738974e3621eefcd4f16a910ded6bbc9a084ce95bf2bd2`. Evidence: `.data/releases/validator-3bcfbd6b259d614289aef4f06cb706e26448d69b-1791811372291/`. Linux ARM64 only. The 121-package inventory passes the vulnerability gate using database `2026-10-12T06:45:22Z`: no blocking matches, 113 Medium and 6 Low matches retained. No exception or suppression was added.

Thirteen Java license reviews remain: Angus activation, Commons IO/Lang, istack, Jakarta activation/bind, Jansi, JAXB core/runtime, JRE jrt-fs, SLF4J API/simple and txw2. Most have no detected declaration; Jansi and Jakarta activation have non-allowlisted textual declarations. Embedded notices give useful evidence but do not automatically resolve these findings.

Coverage remains blocked for Saxon-HE 12.9, picocli 4.7.7 and XML Resolver. The first two versions are declared by the embedded POM; XML Resolver classes are present without identified version metadata. These libraries are not covered by the raw scanner's package inventory. No final validator manifest was created.

The exact final validator passed all 20 Chromium/WebKit container journeys and official-validation checks with the previously accepted application image pair. Functional logs and immutable input IDs are retained alongside the blocked security evidence.

Next: establish complete shaded-library provenance and versions, assess a pinned upstream distribution retaining separate library metadata, retain appropriate notices, and repeat all gates. Changes to executable packaging or dependencies require official-validation regression tests. Then proceed to signed provenance and staging/rollback acceptance; local scan results alone do not authorize production promotion.
