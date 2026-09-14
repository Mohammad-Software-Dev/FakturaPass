# ADR 0011 — Derived review tasks and separate ownership

Status: implemented for the local FP-010 milestone.

The review queue derives work from current invoice revisions, validation results and recipient-profile applicability. It does not introduce another invoice state machine or a manual dismissal that could hide failing checks. Completed download workflows leave the ordinary queue; stale selected recipient evidence can create a new review task without rewriting historical exports.

Ownership is an invoice-level tenant-scoped record with optimistic version checks and immutable audit events. Claims derive their actor from the authenticated context. Concurrent claims and requests tied to stale invoice revisions fail safely. Ownership follows corrections. It grants no additional role privileges and does not constitute approval.

The local slice supports self-assignment and release. Delegation to other members awaits production identity/tenant administration. Unimplemented delivery, rejection and master-data workflows do not produce fabricated queue states. The initial read model evaluates current records before pagination; production scaling is a separate load-test gate.
