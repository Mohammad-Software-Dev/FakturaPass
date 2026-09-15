# Team access and membership authorization

Stage 1 of COMPLETION_PLAN.md begins with database-backed authorization. Local token configuration identifies a tenant and subject; its `role` field, if present in an older configuration, is ignored. Each authenticated request reads the active membership from PostgreSQL. Missing or suspended memberships are denied. The local browser uses the seeded `local-operator` membership in `local-demo`.

Open **Team access** to inspect existing memberships. An active administrator can select a role and access status, then choose **Save access**. Roles remain ADMIN, OPERATOR, APPROVER and READ_ONLY; this screen does not change invoice approval permissions. Suspending a membership blocks subsequent requests, while existing invoices, evidence and review assignments remain preserved. Requests already authorized and in progress are not retroactively cancelled.

Changes bind to the membership version displayed. A stale save returns a conflict and refreshes the list. All changes for a tenant serialize around a tenant lock and recheck the administrator's current membership. The last active administrator cannot be demoted or suspended, including during simultaneous changes. Successful role/status changes create immutable audit events without invoice contents. There is no deletion or arbitrary tenant/subject reassignment through this API.

- `GET /api/v1/memberships`: administrator-only list for the authenticated tenant; includes the current actor and membership versions.
- `POST /api/v1/memberships/{membershipId}`: `{role, status, expectedVersion}`. Status is ACTIVE or SUSPENDED. Cross-tenant IDs return not found; unsupported properties are rejected.

Migration 007 adds unique tenant/subject memberships, constrained roles/statuses, versions and update timestamps. Existing development users retain their memberships. A previous local API token using an actor without a membership will now be denied; for local experiments use an existing explicitly authorized development subject. Membership creation, verified invitations, identity-provider subject binding, profile display names, tenant switching and production sessions are subsequent increments. Production authentication remains disabled, and there is no sign-up, email invitation or provider purchase in this increment.
