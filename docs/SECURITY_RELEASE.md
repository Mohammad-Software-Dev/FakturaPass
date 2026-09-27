# Release security checks

`npm run release:images` now gates both immutable application image IDs on full-image vulnerability scans and dependency license review. This extends the stage 2 packaging checks; it does not approve a production release.

## Run and inspect

From a clean committed checkout, run `npm run release:images`. To investigate an existing local image without rebuilding, run `npm run security:image -- sha256:<64-character-image-id> web`. The standalone command accepts immutable IDs only and writes to `.data/security-reports/`; release evidence remains in `.data/releases/`. Both commands return a nonzero exit code when findings block release or scanning fails.

Syft inventories the exported image filesystem, including supported Debian/Ubuntu or Alpine OS packages and npm packages, and produces native JSON and SPDX JSON. Grype matches that inventory against its vulnerability database. The checked-in scanner lock pins native release archives by SHA-256 for macOS ARM64 and Linux AMD64/ARM64. Downloads use official Anchore GitHub release assets; checksums are rechecked on cache reuse. The scanners run with isolated configuration and without Docker socket access. Docker is used only to export the selected image. Allow several GB of free disk space for the database download, extraction and temporary image export; the initial database download is large. Tools and database caches live under `.data/`.

The policy in `infra/security/policy.json` blocks High, Critical and Unknown severity findings, including findings with no available fix. Lower severity findings remain in evidence. Missing or invalid reports, suppressed findings, mismatched scanner versions and databases older than 120 hours fail the gate. Scan errors are recorded as `SCAN_UNAVAILABLE`, never as a clean result. A successful scan may still have blocked findings.

Dependency licenses use declarations from the installed image's npm packages, including dependencies bundled inside Next.js. Missing declarations and unfamiliar expressions require review. The exact first-party root at `/app/package.json` is recorded separately; a third-party package using the same name is still checked. The npm CycloneDX dependency-graph inventory is retained for comparison, but is not authoritative for installed contents: npm can list omitted transitive packages even when `--omit=optional` is used. Native Syft and SPDX inventories show the installed filesystem. The permissive-license allowlist is an engineering rule, not legal approval. OS/native licenses and third-party notices still require separate review.

The runtime uses digest-pinned Node 22.23.3 on Alpine 3.24; build stages use Debian 13. APK/libapk and their unused system zlib dependency are removed through the package manager, with accurate package metadata retained. See ADR 0021 for compatibility and platform-support requirements. Optional packages, including Sharp/libvips and native build compilers, are omitted from the production dependency installation. Full dependencies remain available in build stages. Image optimization is disabled because the invoice UI does not use it; container acceptance checks the endpoint returns 404 and that Sharp packages are absent. Future image-transformation features require an explicit dependency and license review.

Security exceptions require an exact advisory ID, package URL, name and version, a reason, accountable owner, review reference and expiry. No exceptions are configured. Adding an exception requires a recorded authorized risk decision; do not add broad exclusions or lower severity thresholds just to obtain a passing build.

## Evidence and promotion

For each image, retain the raw inventory, raw vulnerability report, evaluated security report and evaluated license report. The release command records the input policy and scanner lock hashes and hashes the reports in its final manifest. It writes that manifest only after both image policies, container acceptance and npm audit pass. An incomplete directory or a standalone scan is not release approval. CI retains failed release evidence for diagnosis as well as successful evidence.

Current acceptance and remediation status are recorded in RELEASE_A_RESULTS.md. Next steps include base-image remediation and license review, followed by signed registry provenance, approved staging deployment/rollback, off-site recovery and operational acceptance. The invoice validator is a separate image and requires its own release security acceptance before deployment; these commands cover the web and worker images only.

Tool references: [Syft output formats](https://oss.anchore.com/docs/guides/sbom/json/), [Grype scan targets](https://oss.anchore.com/docs/guides/vulnerability/scan-targets/) and [Grype configuration](https://oss.anchore.com/docs/reference/grype/configuration/).

The four current installed-package license review requirements have a concrete packet in [DEPENDENCY_LICENSE_REVIEW.md](DEPENDENCY_LICENSE_REVIEW.md). OS inventory reports are now `<target>-os-packages.json`, derived from the scanned image; older Debian-only releases used TSV.
