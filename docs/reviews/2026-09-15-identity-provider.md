# Identity provider recommendation — 15 September 2026

Recommend Auth0 with an EU tenant for the first provider acceptance exercise. Its hosted sign-in, MFA and documented B2B organization options fit this product's identity needs. FakturaPass keeps memberships and roles in its own database; the initial integration does not require provider organization features.

This is a recommendation, not a purchase or a recorded provider approval. Before creating the production tenant, review the applicable plan and cost, MFA availability/policy, account recovery, data processing agreement, subprocessors, residency scope and operational ownership. An EU tenant region alone is not proof that every processing activity is confined to the EU. No prices, legal assurances or production credentials are assumed.

Primary references reviewed:

- [Auth0 tenant creation and regions](https://auth0.com/docs/get-started/auth0-overview/create-tenants)
- [Auth0 MFA](https://auth0.com/docs/secure/multi-factor-authentication)
- [Auth0 organizations](https://auth0.com/docs/manage-users/organizations/organizations-overview)
- [OpenID client authorization-code example](https://github.com/panva/openid-client/blob/main/examples/oauth.ts)

The implemented adapter uses standard OIDC discovery/code flow and can be configured for another compatible confidential-client provider. Next provider acceptance must cover the exact issuer/callback, MFA and recovery, unknown or suspended members, expiry, provider outages and the distinction between app logout and provider SSO logout.
