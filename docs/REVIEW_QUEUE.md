# Review queue

Open **Review queue** to see invoices with unfinished work. Tasks come from the latest revision, validation result and current recipient coverage. Filter by **All open tasks**, **My invoices**, **Unassigned**, or a task type. Refresh after completing work or to see new results; use the paging controls for larger queues.

Each invoice shows the reason it needs attention, its current owner and a suggested next step. **Assign to me** records responsibility without changing invoice data, validation or approval. **Release assignment** returns your invoice to the unassigned queue. Open its workspace to review findings, correct a revision, validate, approve or generate XML through the existing controls.

Processing failures explain that the worker retries automatically. Unsupported cases remain visible for review. A missing or stale recipient profile points to the requirements workflow. Ownership persists across corrected revisions so an invoice does not lose its responsible person while being fixed.

The queue is derived, not manually dismissed. A completed validated XML export leaves the ordinary queue even when recipient coverage was explicitly unknown in the download workflow. A subsequently expired, replaced or mismatched selected profile can create a new recipient-review task; this does not change historical evidence or invalidate an already downloaded file. Active jobs appear only when they have a reported processing error.

## Authorization and concurrency

Administrators, operators and approvers may claim work for their own authenticated identity. A person cannot claim an invoice already owned by another person. The owner can release it; administrators can release it through the API. Read-only users may inspect the queue and invoice workspaces but cannot change ownership. Arbitrary assignee identities are rejected. Team-member delegation awaits production identity/tenant administration.

Assignments carry a version and the request binds to the revision the user saw. A concurrent claim or intervening invoice correction returns a conflict and the UI refreshes the current assignment. Ownership changes produce immutable audit events. Tenant-scoped foreign keys and queries protect invoices and assignments.

## API

- `GET /api/v1/review-queue?owner=all&reason=&limit=50`: derived, priority-ordered tasks. Owners: `all`, `mine`, `unassigned`. A page contains at most 100 invoices; use the returned `nextCursor` with the same filters and authenticated actor. The cursor is tenant/actor/filter scoped. Counts describe all current tasks by ownership; `total` describes the filtered result.
- `POST /api/v1/review-queue/{invoiceId}/assignment`: `{action: "CLAIM" | "RELEASE", expectedRevisionId, expectedVersion}`. Version 0 represents an unassigned record that has never been claimed. The server derives the owner.

The current local implementation computes coverage and filters over the tenant's latest invoice revisions before returning a page. Production-volume load testing and optimized queue projections remain operational hardening work. Delivery uncertainty, recipient rejection and master-data changes are not represented as simulated tasks: their underlying features must exist first.
