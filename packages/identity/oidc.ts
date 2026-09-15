import * as oidc from "openid-client";
import { randomBytes, randomUUID } from "node:crypto";
import { pool, transaction } from "../database";
import { ApiError, type Context } from "../domain/service";
import { sha256, stable } from "../domain";
import { resolveMembership } from "./memberships";

export const oidcEnabled = () => process.env.AUTH_MODE === "oidc";
export const principalActor = (issuer: string, subject: string) =>
  `oidc_${sha256(stable([issuer, subject]))}`;
export function settings() {
  if (!oidcEnabled()) throw new ApiError("AUTH_REQUIRED", 401);
  const issuer = new URL(process.env.OIDC_ISSUER ?? "");
  const origin = new URL(process.env.APP_ORIGIN ?? "");
  const environment = process.env.FAKTURAPASS_ENV ?? "";
  const local = environment === "LOCAL";
  const acceptable = (url: URL) =>
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    (url.protocol === "https:" ||
      (local &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)));
  if (
    !acceptable(issuer) ||
    !acceptable(origin) ||
    origin.pathname !== "/" ||
    !["LOCAL", "SANDBOX", "PILOT", "PRODUCTION"].includes(environment) ||
    !process.env.OIDC_CLIENT_ID ||
    !process.env.OIDC_CLIENT_SECRET
  )
    throw Error("OIDC_CONFIGURATION_REQUIRED");
  const authority = sha256(
    stable([
      issuer.href,
      origin.origin,
      environment,
      process.env.OIDC_CLIENT_ID,
    ]),
  );
  return {
    issuer,
    origin: origin.origin,
    environment,
    local,
    authority,
    clientId: process.env.OIDC_CLIENT_ID,
    clientSecret: process.env.OIDC_CLIENT_SECRET,
    callback: `${origin.origin}/api/v1/auth/callback`,
  };
}
const token = () => randomBytes(32).toString("base64url");
export function cookieName(kind: "session" | "login") {
  return `${settings().local ? "" : "__Host-"}fakturapass-${kind}`;
}
export function readCookie(raw: string | null, name: string) {
  const values = (raw ?? "")
    .split(";")
    .map((v) => v.trim())
    .filter((v) => v.startsWith(`${name}=`));
  if (values.length !== 1) return "";
  const value = values[0].slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : "";
}
export function authCookie(
  kind: "session" | "login",
  value: string,
  maxAge: number,
) {
  return `${cookieName(kind)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${settings().local ? "" : "; Secure"}`;
}
export function requireOrigin(request: Request) {
  if (request.headers.get("origin") !== settings().origin)
    throw new ApiError("ACCESS_DENIED", 403);
}
async function configuration() {
  const s = settings();
  return oidc.discovery(s.issuer, s.clientId, s.clientSecret, undefined, {
    timeout: 10,
    execute: [
      ...(s.local ? [oidc.allowInsecureRequests] : []),
      oidc.enableNonRepudiationChecks,
    ],
  });
}
export async function beginLogin() {
  const s = settings(),
    config = await configuration();
  const browserToken = token(),
    state = oidc.randomState(),
    nonce = oidc.randomNonce(),
    verifier = oidc.randomPKCECodeVerifier();
  await pool.query(
    "DELETE FROM oidc_login_transactions WHERE expires_at<=now()",
  );
  await pool.query(
    "INSERT INTO oidc_login_transactions(token_sha256,authority_sha256,state,nonce,code_verifier,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '10 minutes')",
    [sha256(browserToken), s.authority, state, nonce, verifier],
  );
  const url = oidc.buildAuthorizationUrl(config, {
    redirect_uri: s.callback,
    scope: "openid",
    response_type: "code",
    state,
    nonce,
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
    code_challenge_method: "S256",
  });
  return { url: url.href, cookie: authCookie("login", browserToken, 600) };
}
export async function finishLogin(request: Request) {
  const s = settings();
  const browserToken = readCookie(
    request.headers.get("cookie"),
    cookieName("login"),
  );
  if (!browserToken) throw new ApiError("AUTH_REQUIRED", 401);
  const attempt = (
    await pool.query(
      "DELETE FROM oidc_login_transactions WHERE token_sha256=$1 AND authority_sha256=$2 AND expires_at>now() RETURNING *",
      [sha256(browserToken), s.authority],
    )
  ).rows[0];
  if (!attempt) throw new ApiError("AUTH_REQUIRED", 401);
  const callback = new URL(s.callback);
  callback.search = new URL(request.url).search;
  const tokens = await oidc.authorizationCodeGrant(
    await configuration(),
    callback,
    {
      pkceCodeVerifier: attempt.code_verifier,
      expectedState: attempt.state,
      expectedNonce: attempt.nonce,
      idTokenExpected: true,
    },
  );
  const claims = tokens.claims();
  if (!claims?.sub || claims.iss !== s.issuer.href)
    throw new ApiError("AUTH_REQUIRED", 401);
  const actor = principalActor(claims.iss, claims.sub);
  const sessionToken = token();
  await transaction(async (db) => {
    const members = (
      await db.query(
        "SELECT tenant_id FROM memberships WHERE user_subject=$1 AND status='ACTIVE' ORDER BY tenant_id",
        [actor],
      )
    ).rows;
    if (members.length !== 1) throw new ApiError("ACCESS_DENIED", 403);
    await resolveMembership(members[0].tenant_id, actor, db);
    const old = readCookie(
      request.headers.get("cookie"),
      cookieName("session"),
    );
    if (old)
      await db.query("DELETE FROM auth_sessions WHERE token_sha256=$1", [
        sha256(old),
      ]);
    await db.query("DELETE FROM auth_sessions WHERE expires_at<=now()");
    await db.query(
      "INSERT INTO auth_sessions(token_sha256,authority_sha256,tenant_id,actor_subject,environment,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '8 hours')",
      [
        sha256(sessionToken),
        s.authority,
        members[0].tenant_id,
        actor,
        s.environment,
      ],
    );
    await db.query(
      "INSERT INTO audit_events(id,tenant_id,actor_subject,action,resource_type,resource_id,request_id,metadata_json) VALUES($1,$2,$3,'SIGN_IN','membership',$3,$4,'{}')",
      [randomUUID(), members[0].tenant_id, actor, randomUUID()],
    );
  });
  return authCookie("session", sessionToken, 28800);
}
export async function sessionContext(
  rawCookie: string | null,
  requestId: string,
): Promise<Context> {
  const s = settings(),
    value = readCookie(rawCookie, cookieName("session"));
  if (!value) throw new ApiError("AUTH_REQUIRED", 401);
  const row = (
    await pool.query(
      "SELECT tenant_id,actor_subject FROM auth_sessions WHERE token_sha256=$1 AND authority_sha256=$2 AND environment=$3 AND expires_at>now()",
      [sha256(value), s.authority, s.environment],
    )
  ).rows[0];
  if (!row) throw new ApiError("AUTH_REQUIRED", 401);
  return {
    tenantId: row.tenant_id,
    actor: row.actor_subject,
    role: await resolveMembership(row.tenant_id, row.actor_subject),
    environment: s.environment,
    requestId,
  };
}
export async function logout(request: Request) {
  requireOrigin(request);
  const value = readCookie(
    request.headers.get("cookie"),
    cookieName("session"),
  );
  if (value)
    await pool.query(
      "DELETE FROM auth_sessions WHERE token_sha256=$1 AND authority_sha256=$2",
      [sha256(value), settings().authority],
    );
  return authCookie("session", "", 0);
}
