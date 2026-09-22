# ADR 0018: Private aggregate operational monitoring

Date: 2026-09-22
Status: Accepted for the local stage 2 baseline

## Decision

Expose an opt-in operations snapshot behind a dedicated random secret, separate from customer identities and support grants. Provide an operator CLI using direct database access. Keep public readiness limited to database/validator readiness. Aggregate queue and worker state by environment; persist job outcome counters atomically with processing results, and keep bounded request counters per web process. Log only declared operation names, status classes, durations and server-generated observation IDs.

Workers heartbeat independently of processing and claim only jobs in their configured environment. Probe database health through a separate bounded pool. Report missing data as unavailable rather than zero. Monitor old retrying jobs even during their backoff delay.

## Consequences

Collectors must address each web instance and handle counter resets. Durable job metrics begin at this migration and count attempts, not billable invoices. Production alert routing, retention, thresholds, load acceptance and service commitments remain explicit deployment work. Operators must stop old worker binaries during migration and clear restored heartbeats after recovery verification. See OBSERVABILITY.md for the complete procedure and acceptance evidence in RELEASE_A_RESULTS.md.
