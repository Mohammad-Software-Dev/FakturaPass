# Application images and release evidence

This stage 2 increment packages web and worker processes for repeatable local builds. It does not select hosting, publish a registry image, configure production secrets or approve a production launch.

## Build and verify

Docker, Node 22 and the installed lockfile dependencies are required. Start from a clean committed checkout and run:

```sh
npm ci
npm run release:images
```

The command builds `fakturapass-web:<full-commit>` and `fakturapass-worker:<full-commit>`, then runs acceptance against their immutable local image IDs. It creates an isolated test network, temporary PostgreSQL storage and the pinned validator; imports and officially validates a synthetic invoice; verifies non-root/read-only operation, disabled unauthenticated monitoring, health and graceful worker shutdown; then removes its test containers and network. Your running application and database are not used. The validator setup downloads checksum-verified dependencies if needed.

Evidence is retained under `.data/releases/<commit>-<timestamp>/`: inspected image metadata, BuildKit metadata, npm CycloneDX SBOMs, dependency license declarations, Debian package inventories, dependency audit results and container acceptance output. `manifest.json` is written last, only after full-image security and dependency license gates, acceptance and the high/critical npm audit gate pass. It records the source revision, immutable image IDs, architecture and input/evidence hashes. A directory without that final manifest is incomplete. Evidence stays local and is excluded from Git; copy the complete directory to approved release storage before discarding the workstation or CI artifact. Hashes detect changes but do not authenticate an unsigned manifest.

The build uses a digest-pinned Node 22 Debian base and `npm ci`. Development and optional packages, plus unused global npm/Corepack/Yarn tools, are removed from runtime images. The build retains full dependencies; the runtime disables unused Next.js image optimization and omits Sharp/libvips. Both targets share the same production dependency installation; the worker intentionally includes that shared dependency set rather than claiming a minimal worker-specific SBOM. Its TypeScript entry points are bundled as ESM and executed by Node, without runtime tsx. The web target serves the production Next.js build. The allowlisted context includes source and the three checked-in synthetic examples required by the page, while excluding local databases, backups, environment files, Git history and validator binaries.

Repeatability means fixed source, base image and lockfile inputs; it does not claim byte-for-byte deterministic Next.js output. Image IDs and platform are recorded for each actual build. Local image IDs are not registry manifest digests: after approved publication, record the registry digest and deploy by that digest, not a mutable tag.

## Runtime contract

Run web and worker separately from the same release, as UID/GID 10001, with a read-only root filesystem, `/tmp` tmpfs, all capabilities dropped and no-new-privileges. Web listens on container port 3010; put it behind the approved TLS proxy. Neither image starts PostgreSQL, the validator or migrations implicitly.

Supply runtime secrets through the deployment secret mechanism. Required shared configuration is `DATABASE_URL`, `INVOICE_ENGINE_URL` and `FAKTURAPASS_ENV`. Images default to PRODUCTION and OIDC. Non-local environments refuse local browser identity or non-OIDC mode. OIDC web startup additionally requires `APP_ORIGIN`, `OIDC_ISSUER`, `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET`; follow IDENTITY.md for issuer, HTTPS and provider acceptance. Never put secrets into build arguments or image layers. Monitoring configuration follows OBSERVABILITY.md. LOCAL overrides are for synthetic acceptance only.

The image entry point accepts these explicit commands:

| Command                | Purpose                                                                           |
| ---------------------- | --------------------------------------------------------------------------------- |
| web                    | Start the production web server; web image only.                                  |
| worker                 | Process jobs and publish worker heartbeats.                                       |
| migrate                | Apply forward-only database migrations as a separate operator job.                |
| operations             | Print operational health and exit nonzero when degraded.                          |
| identity-provision     | Provision an approved issuer/subject membership using the existing CLI arguments. |
| organization-bootstrap | Create an organization and its first administrator.                               |
| support-agent          | Register or offboard an approved specialist.                                      |
| mapping-register       | Register a mapping recipe; mount its input read-only.                             |

The entry point forwards SIGTERM/SIGINT. Allow enough stop time for in-flight work and the worker's graceful heartbeat cleanup. Force-stopped jobs retain leases and recover according to the existing worker rules. The application images do not contain Docker or PostgreSQL backup tooling; use the separately approved database backup process.

## Upgrade and rollback

Retain the previous image IDs/digests, configuration versions and a verified backup. Stop old workers before migrations that change job behavior. Run the migration command once under operator control; start compatible web/worker images, check readiness and operational health, and exercise a synthetic workflow before routing customer traffic. Forward-only migrations do not make arbitrary old-image rollback safe. Record schema compatibility for each release; if incompatible, recover through a rehearsed restore/cutover procedure rather than blindly starting an old binary. Follow RECOVERY.md for restored credentials, grants and heartbeat invalidation.

## Remaining production gates

Full-image Syft/Grype scans and an exact dependency license policy now gate final release evidence; see [SECURITY_RELEASE.md](SECURITY_RELEASE.md). Outstanding findings must be remediated or receive an authorized, bounded review before promotion. Signed registry attestations, platform-specific acceptance, registry publication and deployment/rollback rehearsal remain open. Local inventories and hashes do not authenticate unsigned provenance. The separate validator image also needs security acceptance before deployment.
