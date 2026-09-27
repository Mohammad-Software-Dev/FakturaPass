# ADR 0021: Separate build and application runtime bases

Status: application runtime candidate; production platform/support and license acceptance remain open.

Debian 13 reduced the application images' blocking findings to 48, but still included libraries and utilities not required by the invoice processes. Use a digest-pinned official Node 22.23.3 Alpine 3.24 runtime while retaining the digest-pinned Debian 13 build stages. Production dependencies omit optional/development packages; the build rejects native `.node` add-ons before copying dependencies between libc environments. Native dependencies added later require an explicit compatible build/runtime design.

Remove npm, Corepack and Yarn from runtime. Remove APK, libapk and their unused system zlib dependency through APK itself, retaining accurate installed-package metadata. Inspection showed Node dynamically links to musl, libstdc++ and libgcc, not system zlib. Node reports its own bundled zlib version as `1.3.1-e00f703`; acceptance checks compression/decompression as well as invoice processing. No package metadata is deleted to hide findings and no scanner exceptions are used.

Inventory validation now explicitly supports Debian/Ubuntu deb inventories and Alpine apk inventories, and requires npm coverage. Unknown distributions or missing OS/application package coverage fail. The release retains OS packages as structured JSON derived from that same image inventory, avoiding a runtime dependency on dpkg-query or APK executables.

Alpine is a compatibility choice, not merely a smaller image. The [official Node image documentation](https://github.com/nodejs/docker-node#nodealpine) describes the musl difference and classifies AMD64 musl builds as Experimental. Local Linux ARM64 acceptance must not be presented as approval of AMD64 or of the production support model. Reassess the selected platform and maintainers' support status before deployment; the prior Debian candidate is retained locally as a comparison/fallback.

The last system-zlib blocker was CVE-2026-85091. Its [publisher advisory](https://www.vulncheck.com/advisories/zlib-1.3.1.2-through-1.3.2-heap-buffer-overflow-via-gz-vacate) identifies affected versions 1.3.1.2–1.3.2. Removal addresses the installed Alpine library finding; it is not a blanket claim that every bundled Node dependency is vulnerability-free. Raw scan findings, including lower severities, remain retained.

Container acceptance now runs the three customer example import/review/export journeys, language/error recovery and appearance checks in Chromium and WebKit against the actual image, alongside configuration, migration, official validation, metrics and graceful shutdown checks. Final evidence and remaining blockers are in RELEASE_A_RESULTS.md.
