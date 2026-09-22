# ADR 0019: Separate application images with retained local release evidence

Date: 2026-09-22
Status: Accepted for stage 2 packaging

## Decision

Build web and worker targets from a digest-pinned Node base and lockfile-installed dependencies. Run under an unprivileged UID with explicit runtime configuration. Bundle worker/operator TypeScript entry points, keep migrations explicit, and restrict the build context to required source. Retain image IDs, architecture, npm SBOM/license declarations, OS package inventory, audit output and isolated container acceptance in a hash-indexed release directory tied to a clean Git revision.

## Consequences

The shared production dependency set simplifies packaging and inventory at the cost of a larger worker image. Local IDs identify tested content but do not replace registry digests or signed attestations. Repeatable inputs do not guarantee byte-identical Next.js output. Full-image vulnerability/license policy, registry signing, hosting configuration and production deployment/rollback remain subsequent gates. See DEPLOYMENT_IMAGES.md for commands, upgrade behavior and evidence limits.
