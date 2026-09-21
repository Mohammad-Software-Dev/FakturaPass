# Identity onboarding and offboarding acceptance

The local authorization workflows are implemented. Isolated issuer/browser tests establish application behavior; they do not replace live-provider, personnel, MFA, privacy or customer acceptance. Use this checklist when accepting the configured provider and onboarding a pilot organization.

## Onboarding

1. Verify the operator, exact issuer/subject and organization administrator through the approved identity process. Bootstrap a new organization without overwriting an existing organization or membership; see ORGANIZATION_ONBOARDING.md.
2. Sign in with the configured provider. Confirm the correct organization name and role. Open two workspace tabs and verify actions stay in their selected workspace.
3. Have an administrator invite a verified email address with the least necessary role. Test acceptance with the intended provider claims; a mismatched/unverified address must fail. Existing roles and suspensions must remain unchanged.
4. If an integration is needed, create a named, scoped, expiring API credential. Store it securely, exercise a permitted request and a denied request, then test replacement and revocation. Existing invoice approval and generation gates still apply.
5. Register support personnel only after operator identity/personnel review. Registration alone must not permit sign-in or customer data access. Have the customer administrator authorize a specific revision for a stated issue, verify the specialist sees that revision only, and revoke the grant. See SUPPORT_ACCESS.md.
6. Record provider sign-in, claim mapping, app logout, provider SSO behavior, privileged-account MFA, recovery procedures and responsible contacts. These live-provider checks remain pending; no live tenant or policy was configured by development tests.

## Member and integration offboarding

- Suspend the member in Team. The next workspace request and credentials owned by that member must be denied. Preserve another active administrator; the last administrator cannot be removed or demoted without replacement.
- Permanently revoke the member's API credentials and pending invitations, and revoke support grants they authorized. Suspension/role loss blocks access immediately on subsequent requests, but explicitly revoke those grants/links/keys when access must not return after later reactivation.
- Disable the person's provider account and sessions through the approved identity-provider process where appropriate. App logout revokes the current application session; it does not promise provider-wide SSO logout. Verify the provider's recovery and account-disable behavior before production acceptance.
- For support personnel, run the specialist suspension operation. It disables the registry entry and revokes all their grants atomically. Verify a still-open specialist browser cannot make another diagnostic read.
- Preserve required audit and invoice evidence. Do not delete immutable records as a substitute for disabling access. Organization closure, agreed retention, export/deletion workflows and legal responsibilities belong to the later data-lifecycle/commercial milestones and remain open.

## Recovery and evidence

Recovery cutover requires session invalidation, pending invitation revocation, credential revocation, support-grant revocation and specialist-registry reconciliation after snapshot verification; see RECOVERY.md. Obtain fresh customer grants afterward.

Record actor, organization, environment, date, observed results and the responsible approver for the live acceptance exercise. Store no passwords, secrets or invitation tokens in its report. Test evidence and remaining release limitations are tracked in RELEASE_A_RESULTS.md and COMPLETION_PLAN.md.
