# ADR 0015: Operator bootstrap and verified invitation acceptance

Status: implemented for isolated acceptance, 21 September 2026.

Create the first workspace administrator through an audited operator command using a verified HTTPS issuer/subject. Do not enable public organization creation before commercial onboarding and abuse controls are agreed.

Administrators issue manually shared, revocable, 72-hour links. Store token hashes, bind links to the configured identity authority, and bind the invitation ID to the PKCE login transaction. At callback, require the exact invited email and boolean verification claim in the signed ID token, then atomically create the issuer/subject membership and consume the invitation. Require the inviting administrator to retain active ADMIN access. Existing roles and suspensions cannot be overridden through this path.

Email is invitation evidence, not an identity key. OpenID Connect identifies users by issuer plus subject and describes email verification separately; email itself is not guaranteed unique. See [OpenID Connect Core §5.1 and §5.7](https://openid.net/specs/openid-connect-core-1_0-18.html#StandardClaims). Provider configuration and acceptance must verify how those claims are actually produced.

Manual sharing provides a usable invitation workflow before an email provider is approved. No delivery, bounce tracking or sender setup is implied. Record retention is separate from link expiry and remains an operational/privacy decision.
