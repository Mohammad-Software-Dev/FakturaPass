# Local operations

Use `npm run dev` for the full local stack and `npm run verify` for isolated verification. See the README for prerequisites and ports. PostgreSQL persists across restarts; schema changes are forward-only migrations and never created implicitly by request handlers.

The launcher checks its web port before starting child services, waits for the web health endpoint, and stops its worker, web server and locally started validator together on Ctrl+C or a child failure. If port 3010 is occupied, stop the existing launcher or choose an unused loopback port with `PORT=3011 npm run dev`.

## Recovery

Create a local database snapshot with `npm run backup:create`, then run `npm run backup:verify -- <directory>` to restore and verify it in a separate temporary database. See [RECOVERY.md](RECOVERY.md) for retained recovery copies, integrity checks and limitations.

If Java is unavailable, the worker leaves the validation in ERROR, keeps its durable job pending, and retries after five seconds. Restart `npm run engine` (or the pinned container). The worker reclaims expired leases after 120 seconds. Do not reimport with a new source identity to recover a technical failure.

Stopping the worker leaves jobs in PostgreSQL. Restart `npm run worker` with the same DATABASE_URL to resume. The source revision and approval remain immutable. Successful validation/artifact/evidence writes commit atomically; replay cannot duplicate artifacts or approvals. A stale approval or correction is rejected with a stable conflict code.

## Integrity and privacy

The local identity is only for synthetic data on loopback. Request logs contain opaque request/job identifiers and stable error codes, never invoice bodies or bank details. Invoice routes are not exposed with production identity. Downloads verify hashes and tenant relationships; there are no public object URLs. The official engine validates generated UBL only; DOCTYPE/entity declarations are rejected before submission.

The pinned engine container has a read-only filesystem, non-root UID, dropped capabilities, a dedicated bridge network and loopback-only port. Container image digests and validator/config archive hashes are fixed in source. No runtime rule updates occur.

## Rule changes

Create a new dependency manifest and ADR; verify licenses/checksums; run all positive and negative fixtures; compare official findings and golden XML; retain old validation evidence. Never update goldens solely to make a failing test pass. The initial normalized report snapshots include informational BR-DE-TMP-32; it does not justify inventing a service date.

## Release boundary

Production backup/restore guarantees, customer retention periods, external security review, production identity, monitoring SLAs, billing and transport remain Release B/C gates. No real customer data or production secrets belong in this demonstrator.
