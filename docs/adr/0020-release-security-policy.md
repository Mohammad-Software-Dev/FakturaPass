# ADR 0020: Full-image release security policy

Status: accepted for local engineering gates; production acceptance remains pending.

The application lockfile audit cannot see vulnerable tooling and OS packages inherited from the runtime base. Packaging inventories alone cannot establish whether a release meets a security policy.

Export each immutable local image ID and inventory it with checksum-pinned native Syft. Scan the inventory with checksum-pinned Grype, require a valid database no older than 120 hours, retain raw results, and evaluate the checked-in policy. Block high, critical and unknown findings even without a fix. Reject suppressed findings and invalid scanner output. Require exact, justified, owned and expiring exceptions. Evaluate npm license declarations against an exact allowlist; unfamiliar expressions need review.

Native tools avoid dependence on scanner containers or giving scanners access to the Docker socket. The platform-specific archive lock supports macOS ARM64 and Linux AMD64/ARM64. Network and several GB of disk capacity are required for database updates. Release artifacts remain unsigned local evidence until approved registry publication and signing are implemented.

A failing gate intentionally prevents final release-manifest creation. Neither a clean npm audit nor passing application tests override image findings. See SECURITY_RELEASE.md for operator instructions and RELEASE_A_RESULTS.md for the observed acceptance result.

Follow-up, 27 September 2026: license policy now uses installed npm artifacts from the Syft filesystem inventory, including bundled dependencies. npm's dependency-graph SBOM retained an omitted transitive Sharp package and is retained only as comparative evidence. The exact first-party `/app/package.json` artifact is reported separately; third-party packages with the same name are still evaluated. Missing bundled declarations remain review requirements.
