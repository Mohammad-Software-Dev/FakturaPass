# Local backup and recovery

This is the local operational preparation milestone. It verifies that the current PostgreSQL-backed application can be recovered, including original files, invoice revisions, validation reports, XML artifacts, evidence, recipient profiles, mappings, assignments, audit records and durable jobs. Production backup policies, encryption, off-site storage, point-in-time recovery and RPO/RTO acceptance remain separate decisions.

Run commands from the repository root with the pinned Compose PostgreSQL service running. These tools accept only the local Compose connection on port 5440, its development credentials and `FAKTURAPASS_ENV=LOCAL` (the default). They refuse remote targets and connection-string overrides.

## Create a snapshot

```sh
npm run backup:create
```

The command prints the path of a new directory under `.data/backups/`. The directory contains `database.dump` and `manifest.json`. Keep both together. The directory is private to its owner (0700); new files are 0600. `.data/` is excluded from Git. Backups contain the full database and are not encrypted; the local synthetic-data restriction continues to apply. No secrets or row contents are printed by the tools.

The archive and table fingerprints share one exported repeatable-read snapshot, so normal application writes can continue without causing a false comparison. Each public table has a row count and SHA-256 digest of its ordered serialized rows. The manifest also contains the archive checksum. Incomplete backups are removed after ordinary command failures. Do not run schema migrations concurrently with backup creation.

## Verify recovery without changing the app

Use the directory printed by backup creation:

```sh
npm run backup:verify -- .data/backups/snapshot-EXAMPLE
```

The tool checks archive integrity before restoring. It creates a randomly named `fakturapass_recovery_...` database, restores in a single transaction, and compares every public table against the saved snapshot. A successful result reports table and row counts. The temporary database is then dropped. The source database and original backup stay intact; there is no overwrite or in-place restore option.

To retain a verified recovery copy for inspection:

```sh
npm run backup:verify -- .data/backups/snapshot-EXAMPLE --keep
```

The result prints the new database name. The application and worker are not switched to it automatically. Restored jobs and leases retain their original values; a recovery copy is an inspection environment until an operator explicitly plans a cutover with workers stopped. This tool does not implement a production cutover or prove an external delivery can safely be replayed.

Failed restores are removed when normal error handling completes, including failed table comparisons. A forced process termination or machine outage can leave an incomplete snapshot or a recovery database. Inspect the exact directory/database created by that run before removing it; never delete the working database or all similarly named databases indiscriminately.

Only restore archives created by your trusted local installation. A checksum detects accidental changes; it is not a signature, encryption or authentication of an archive. PostgreSQL archives contain executable database definitions.

## Acceptance

`npm run verify` now runs recovery acceptance after browser workflows have generated invoices, XML and evidence in its isolated database. The recovery tests check archive/record preservation, corruption rejection, failed-restore cleanup, retained-copy behavior, restored immutability triggers and rejection of remote targets. Production-scale timings, storage failure drills, role/global-object restoration and off-site recovery are not covered by this local test.

The implementation uses PostgreSQL 17's [exported snapshots](https://www.postgresql.org/docs/17/functions-admin.html), [pg_dump snapshot option](https://www.postgresql.org/docs/17/app-pgdump.html) and [single-transaction pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html). The pinned container supplies matching database tools.

## Restored identity sessions

Before routing users to a restored database, invalidate restored `auth_sessions` and `oidc_login_transactions` using the recovery operator's database access. A snapshot can contain sessions that were revoked after the snapshot was taken. Invalidate them even when restoring to the same origin and issuer; require users to sign in again. Do not promote a restored environment until this step and its environment/secret checks are complete.
