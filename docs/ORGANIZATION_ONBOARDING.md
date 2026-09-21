# Organization setup and invitations

Organization creation is an operator-assisted step. An approved operator creates a workspace and its first administrator atomically using a verified provider issuer/subject pair. Customer self-service registration, billing and automated invitation delivery are not enabled by this increment.

## Create an organization

Confirm the administrator's subject through the configured provider and the approved organization request. Supply the intended database through the server environment, then run:

```sh
npm run organization:bootstrap -- studio-north "Studio North" https://verified-issuer.example/ VERIFIED_SUBJECT
```

The ID accepts lowercase letters, digits and hyphens, up to 80 characters. The display name is 1–120 characters. The issuer must be the exact HTTPS issuer, including its canonical trailing slash. A tenant, active ADMIN membership and organization audit event are committed together. Existing IDs are rejected, never overwritten. This creates a workspace display name; it does not populate invoice legal entities, tax details, billing or provider accounts.

The command prints the workspace ID and opaque administrator actor. The administrator can sign in once OIDC is configured. Additional previously verified subjects can still be provisioned with `identity:provision`; normal team onboarding should use invitations.

## Invite a colleague

In an OIDC workspace, an administrator opens **Team access → Invite your team**, enters the recipient's email address and selects a role. Read-only is the default. **Create invitation link** shows a private link once. Copy it and share it through your approved communication channel. FakturaPass does not send an email automatically.

The link expires after 72 hours. This is an explicit technical default pending production acceptance, not a retention policy. Creating a new invitation for the same address revokes any pending predecessor. Invitation history shows pending, accepted, revoked, expired and unavailable states. Refresh the panel to see acceptance by a colleague. Revoke a pending invitation to stop it; after acceptance, manage or suspend the membership in Team access instead.

The recipient opens the link, sees the organization, requested role, invited email and expiry time, then selects **Sign in and join**. The identity provider must return that email and the boolean `email_verified: true` in the signed ID token. Invitation sign-in requests `openid email`; ordinary sign-in continues to request only `openid`. Verify the provider's actual claim behavior and email-verification process before live rollout. Do not configure a constant verification claim to bypass missing evidence.

## Access boundaries

- The link token is random, stored only as a SHA-256 hash, and disclosed only on creation. The link carries it in a URL fragment; the join page removes that fragment and submits the token in a bounded POST body. Treat the link as private even though email verification is also required. Reloading the cleaned join URL requires reopening the original invitation link.
- Acceptance rechecks expiry, status, configured identity authority and the issuer administrator's active ADMIN membership. Revocation, replacement or administrator demotion while sign-in is in progress prevents the grant. Configuration changes that alter issuer, client, origin or environment make old links unavailable.
- Memberships bind to the verified issuer/subject pair. Email authorizes this particular invitation; it never merges identities. Domains are compared case-insensitively; the local part is case-sensitive. Address aliases are not merged. The current form supports ordinary ASCII email addresses.
- Acceptance and its audit event commit together under the workspace lock. Concurrent callbacks can consume an invitation only once. Existing active memberships keep their current roles; suspended memberships cannot be reactivated through an invitation.
- Invitation history contains recipient emails. Audit events retain role, invitation ID and a hash of the email rather than a copy of the link or plaintext email. Provider tokens are discarded. Production retention and deletion policies for these records remain part of launch acceptance.

Acceptance uses synthetic accounts and a local issuer. Live provider claims/MFA/recovery, email delivery, legal/privacy review and customer onboarding acceptance remain outstanding.
