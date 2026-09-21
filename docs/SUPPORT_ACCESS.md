# Explicit support access

Support is not a customer role. A registered specialist receives no workspace membership or general invoice access. A workspace administrator must explicitly share one invoice revision, record an issue/ticket reference and confirm consent. The only supported scope is `INVOICE_DIAGNOSIS`: read the selected canonical invoice and its saved validation findings. Other revisions, other invoices, files/download endpoints, mutations, approval, generation, team management, API credentials and grant administration remain inaccessible through support access.

## Customer journey

With OIDC administrator sign-in, open **Team → Support access**. Select a registered specialist and an invoice revision, enter the issue and choose 1–24 hours (initially one hour). The maximum is an implementation safety limit, not a support SLA or commercial policy. Confirm the explanation that personal invoice data and validation results will be disclosed, then choose **Allow support access**.

The selected revision is bound at creation, even if another correction becomes current before or after the grant. The form passes that revision's ID explicitly. The list shows the specialist, invoice/version, issue, status, expiry and last viewed time. Refresh updates the history and available choices; more invoices can be loaded when the first page is insufficient. Revoke access at any time. Extending time or sharing another revision requires a fresh consent and grant.

No email or external message is sent. Coordinate the ticket through your existing support channel. The specialist signs in at `/support` using their own registered provider account. Support-only sign-in lands directly on this screen; accounts with ordinary workspace memberships may open `/support` explicitly. An active support grant never impersonates its authorizing administrator or becomes a customer role.

## Registering and offboarding specialists

Use the same OIDC issuer/client/origin/environment settings as the web service. An operator must verify the exact provider issuer and immutable subject, the person's identity and their approved support responsibilities before registration. Never derive the subject from an email address or user-supplied display name.

```sh
npm run support:agent -- register 'https://YOUR-VERIFIED-ISSUER/' 'VERIFIED-PROVIDER-SUBJECT' 'Support specialist name'
```

The command returns the specialist ID. Registration records an immutable operator event and never grants invoice access. Duplicate registration fails rather than overwriting an identity. The display name is operator-controlled and is what customers select. Production use requires live-provider, privileged-account MFA and personnel/process acceptance; these are not supplied by the synthetic test issuer.

To offboard a specialist:

```sh
npm run support:agent -- suspend 'SPECIALIST-ID'
```

This disables the registry entry and permanently revokes its existing grants in one transaction, recording both registry and tenant audit events. The command does not silently reactivate specialists; reinstatement requires a separately reviewed operator process. A suspended customer membership also blocks support reads for that workspace and prevents new support grants to that identity.

## Enforcement and evidence

Each list/read validates the signed-in issuer/subject, configured authority/environment, specialist status, grant expiry/revocation and the authorizer's current active ADMIN membership. Expiry is enforced against database time on reads. If the authorizer loses administration, grants become unavailable; restoring that role can make otherwise unexpired grants available again, so explicitly revoke grants for permanent offboarding. Ordinary API credentials and bearer tokens cannot enter the specialist endpoints.

Support-only sessions have no tenant membership. The general workspace routes continue to require a real active membership and therefore reject those sessions. Authorization returns a dedicated diagnostic projection rather than a reusable customer Context. Grant IDs are identifiers, not bearer secrets.

`SUPPORT_GRANT_CREATE` records consent, specialist ID, invoice/revision, scope and duration. `SUPPORT_CASE_LIST` records case-metadata access; `SUPPORT_DIAGNOSIS_VIEW` records the specialist's own subject and shared revision. Revocation and support-only sign-in are audited separately. Last viewed records admitted diagnostic reads, not a promise that a human read every field. Registration/suspension events are immutable. No support tool writes invoice data or starts jobs.

Reads already admitted may finish during a later revocation. The browser clears the diagnostic view at expiry and checks available grants every 15 seconds; refresh also closes unavailable views. No browser storage is used for invoice data. Previously disclosed information cannot be recalled, and someone authorized to see data can copy it. The restriction on downloads concerns original/generated file endpoints, not a claim to prevent copying visible information.

## Recovery and remaining acceptance

Apply migration 012 before enabling this release. Before exposing a restored database, revoke all restored support grants and reconcile the restored specialist registry with the current approved personnel list. Suspend any entries that are no longer approved. Perform this after snapshot fingerprint verification and record it alongside session, invitation and API-key invalidation. Obtain fresh customer grants after recovery.

Live-provider sign-in/MFA/recovery acceptance, customer support-process approval, production capacity/rate limits, retention decisions, external security review and hosting remain separate gates. No real support person or customer grant is provisioned by the automated tests.
