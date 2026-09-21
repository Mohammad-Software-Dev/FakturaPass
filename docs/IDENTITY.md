# Sign-in and session operations

FakturaPass supports configurable OpenID Connect authorization-code sign-in. Application memberships remain authoritative. The integration is implemented; acceptance against an actual provider tenant and its MFA policy is still required before production use.

## Configuration

Set `AUTH_MODE=oidc`, `FAKTURAPASS_ENV`, `APP_ORIGIN`, `OIDC_ISSUER`, `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` in the server secret environment. Register the exact callback `${APP_ORIGIN}/api/v1/auth/callback` with the provider. Use a confidential web application with code flow and client-secret POST authentication. The issuer must exactly match the discovery issuer, including its trailing slash. Only the `openid` scope is requested.

HTTPS is required. HTTP loopback URLs are accepted only in LOCAL for isolated testing. LOCAL browser identities and bearer tokens cannot bypass OIDC when that mode is enabled. API keys are not yet implemented. Keep the ordinary local developer setup without AUTH_MODE for the existing local workspace.

## Provisioning an initial member

An operator with approved database access must obtain the verified subject from the configured provider and confirm the destination tenant and role. Never infer the subject from email. Then run:

```sh
npm run identity:provision -- TENANT_ID https://verified-issuer.example/ VERIFIED_SUBJECT ADMIN
```

The command adds an audited active membership, derives its opaque actor from the exact issuer/subject pair and refuses to overwrite an existing membership. Roles are ADMIN, OPERATOR, APPROVER or READ_ONLY. It does not create a tenant or provider account. Verified invitations and organization onboarding are subsequent increments.

Sign-in requires at least one active workspace membership. A single membership opens that workspace; multiple memberships open the workspace chooser. **Switch workspace** returns to the chooser, which lists only the signed-in identity’s active memberships and current roles. An existing session with no active memberships sees a contact-administrator message and can sign out.

The selected workspace belongs to the tab URL, not a shared selection cookie. Every workspace API request in OIDC mode requires `X-Workspace-Id`; GET navigation and download links may use the `workspace` query parameter instead. Missing, conflicting and repeated selectors fail closed, and every selected workspace still requires an active database membership. UI requests and downloads carry the server-rendered tab context, so choosing another workspace in a second tab does not redirect edits from the first tab.

`GET /api/v1/auth/workspaces` lists available workspaces using the verified identity session. Selecting a workspace does not extend the session, modify memberships or grant additional access. Local development identities remain scoped to their server-configured tenant. Invitations and organization creation remain separate work.

## Security and lifetime

Login uses S256 PKCE, state and nonce, validates ID-token signatures through the provider JWKS, and checks issuer, audience and expiry. A login transaction expires after ten minutes and is consumed once. Its browser token is random and only its hash is stored; the short-lived verifier remains server-side.

Successful sign-in issues an eight-hour opaque session. Only its hash is persisted, bound to issuer, client, application origin and environment. Provider tokens are discarded. Cookies are HttpOnly, SameSite=Lax and host-only; outside LOCAL they use Secure and the \_\_Host- prefix. Unsafe requests require the exact configured Origin. Every authenticated request reloads the active database membership, so suspension and role changes take effect without waiting for expiry.

Signing out revokes the current FakturaPass session. It does not terminate the identity provider's SSO session; another sign-in may therefore proceed without another password prompt. MFA enforcement, provider session policy, account recovery and provider logout acceptance must be reviewed in the selected provider configuration. The app does not claim to enforce MFA itself.

After database restoration, invalidate all restored sessions and login transactions before exposing the restored environment. Credentials, deployment rate limits, monitoring and production acceptance remain operational gates.

## Verification

`npm run verify` runs the OIDC suite only against its disposable verification database. A synthetic local issuer exercises signature, nonce, state, audience and expiry rejection, session logout/expiry, membership suspension and authority isolation. Chromium and WebKit exercise the sign-in page, language/theme controls, workspace entry, two simultaneous workspace tabs, suspended-workspace removal and sign-out. These are integration tests, not evidence of acceptance against Auth0 or another live provider.
