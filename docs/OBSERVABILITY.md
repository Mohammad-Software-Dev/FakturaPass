# Operational monitoring

The stage 2 baseline reports service health, environment-specific queue pressure and worker activity without exposing invoice contents or tenant identifiers. It does not configure a monitoring vendor, paging destination or production availability commitment.

## Run a check

Run `npm run operations:check` with the server's `DATABASE_URL`, `INVOICE_ENGINE_URL` and `FAKTURAPASS_ENV`. It prints a JSON snapshot and exits zero when healthy, one when degraded or misconfigured. This trusted operator command connects directly to the database; it does not need an HTTP token. Its request counters belong to the CLI process, not the web server.

For remote collection, configure `OPERATIONS_TOKEN` as a random 43–128 character base64url secret (32 random bytes encoded as base64url produce 43 characters). Store it in the deployment secret manager. Call `GET /api/v1/operations/status` with the `X-Operations-Token` header over private networking and TLS. Missing or malformed server configuration disables the endpoint with 404. Wrong credentials return 401; ordinary API keys, bearer tokens and browser sessions cannot authorize it. Do not send Authorization or X-API-Key headers alongside the operations token. Responses use no-store, return 200 when healthy and 503 when degraded. Rotate the secret through coordinated server/collector configuration. Redact its header in proxies and collectors.

The contract is `fakturapass.operations.v1`, documented in the OpenAPI specification. `/health/live` and `/health/ready` retain their separate purposes: web liveness and database/engine readiness. Queue pressure or a missing worker does not remove healthy web instances from routing.

## Interpret the snapshot

- `queue` counts pending, running, due and retrying jobs and expired leases in the configured environment. `oldestDueSeconds` measures age since creation for pending jobs currently due; `oldestRetrySeconds` includes delayed pending retries, so retry backoff cannot hide an old failure.
- `workers` counts heartbeats received in the last 45 seconds and reports the age of the latest heartbeat. Workers send a heartbeat every 10 seconds and remove it after graceful shutdown. Abrupt termination becomes stale naturally. A heartbeat alone does not establish successful processing; inspect lease and queue alerts too.
- `jobs` contains durable attempt counts and summed durations by job type and outcome. PASSED means completed successfully, REJECTED means a completed business validation rejection, RETRY means a technical failure rescheduled for processing, and RECOVERED means an existing completed result closed a reclaimed job. These are attempt metrics, not invoice totals or billing records. Collection starts with migration 013 and is not retroactive.
- `requests` contains counters and cumulative latency buckets for this serving process, grouped by declared API operation, method and HTTP status class. Unknown paths share a bounded unmatched bucket. Counters reset on process restart; collect each web instance separately. HTTP success does not establish invoice validity. Health and operations probes are excluded.

Database probe failure returns null queue, worker and job fields, never misleading zero counts. Engine and database probes have bounded timeouts. The database probe uses a separate small pool so ordinary request-pool saturation does not consume its connection capacity.

Set `OPERATIONS_REQUEST_LOGS=enabled` to emit structured request completion records. They contain a server-generated observation ID, declared operation, method, status class and duration. The matching `X-Observation-Id` response header helps correlate a request. Raw paths, query strings, headers, bodies, customer identifiers and client-provided request IDs are excluded from these records. Review infrastructure log settings separately; application filtering does not configure proxy logs.

## Respond to alerts

| Alert                | Operator response                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| DATABASE_UNAVAILABLE | Check database connectivity, capacity and locks; unavailable aggregates cannot be interpreted as an empty queue.               |
| ENGINE_UNAVAILABLE   | Check the pinned validator service and connectivity; pending technical failures retry after recovery.                          |
| WORKER_MISSING       | Start or restore a worker using the same database and environment; inspect stable worker error codes.                          |
| JOB_LEASE_EXPIRED    | Inspect worker progress and validator availability; a worker reclaims an expired 120-second lease.                             |
| QUEUE_DELAYED        | Inspect throughput and old due jobs; add capacity only after checking the actual bottleneck.                                   |
| JOB_RETRY_DELAYED    | Investigate persistent technical failures even while their next retry is delayed. Do not reimport invoices to clear the alert. |

The queue/retry warning age defaults to 300 seconds; `OPERATIONS_QUEUE_WARNING_SECONDS` accepts an integer from 1 to 86400. These defaults are diagnostic thresholds, not an agreed SLA. Select collection intervals, sustained-alert windows, retention, escalation owners and paging integrations during production acceptance. No notification is sent by this implementation.

## Upgrade and recover

Stop old workers before applying migration 013, then deploy/restart the web and worker binaries together. Jobs now carry an explicit environment, and workers claim only their configured environment. The migration derives existing job environments from their invoice; unmatched legacy jobs default to LOCAL and require operator review before any non-local processing. Old worker binaries do not enforce this new boundary.

Verify restored table fingerprints before any cutover cleanup. Delete restored worker heartbeats before starting replacement workers or exposing a recovered environment; snapshots are not evidence of currently running processes. Preserve durable job metrics, record the restore point and expect counters to rewind to it. Request counters restart with each process. Follow the security invalidations and worker-stop procedure in [RECOVERY.md](RECOVERY.md).

## Acceptance boundary

The isolated operations tests cover credential rejection, bounded/private telemetry, queue and lease alerts, environment isolation, validation rejection versus retry, replay accounting, real worker startup/shutdown, and a locked database probe. Production load, monitoring collection, on-call routing and disaster recovery remain acceptance work. This baseline does not complete the broader stage 2 deployment and security gates.

Idle application database connection failures are handled with the stable `DATABASE_UNAVAILABLE` code. The pool discards failed idle connections and can reconnect when PostgreSQL is available; it does not print the connection/client object or crash the worker solely because an idle connection was lost. In-flight request failures still return errors and durable jobs retain their retry behavior. This follows the [node-postgres pool error contract](https://node-postgres.com/apis/pool#events).
