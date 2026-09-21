import {
  registerSupportAgent,
  suspendSupportAgent,
} from "../packages/identity/support";
import { readFileSync } from "node:fs";
import { bootstrapOrganization } from "../packages/identity/organizations";
import { spawn, type ChildProcess } from "node:child_process";
import { chromium, webkit, expect } from "@playwright/test";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { generateKeyPairSync, sign, createHash, randomUUID } from "node:crypto";
import { pool } from "../packages/database";
import {
  principalActor,
  authCookie,
  settings,
} from "../packages/identity/oidc";
import { GET, POST } from "../apps/web/app/api/v1/[...path]/route";
let web: ChildProcess | undefined;
const origin = "http://127.0.0.1:3012";
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = {
  ...keys.publicKey.export({ format: "jwk" }),
  kid: "test",
  use: "sig",
  alg: "RS256",
};
const codes = new Map<string, URLSearchParams>();
let issuer = "",
  subject = "approved-user",
  fault = "",
  actor = "",
  claimEmail = "new.member@example.test";
const server = createServer(async (req, res) => {
  const url = new URL(req.url!, issuer);
  res.setHeader("Content-Type", "application/json");
  if (url.pathname === "/.well-known/openid-configuration")
    res.end(
      JSON.stringify({
        issuer,
        authorization_endpoint: issuer + "authorize",
        token_endpoint: issuer + "token",
        jwks_uri: issuer + "jwks",
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        token_endpoint_auth_methods_supported: ["client_secret_post"],
        code_challenge_methods_supported: ["S256"],
      }),
    );
  else if (url.pathname === "/jwks") res.end(JSON.stringify({ keys: [jwk] }));
  else if (url.pathname === "/authorize") {
    const code = randomUUID();
    codes.set(code, url.searchParams);
    const back = new URL(url.searchParams.get("redirect_uri")!);
    back.searchParams.set("code", code);
    back.searchParams.set("state", url.searchParams.get("state")!);
    res.writeHead(302, { Location: back.href });
    res.end();
  } else if (url.pathname === "/token") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const form = new URLSearchParams(body),
      attempt = codes.get(form.get("code")!);
    codes.delete(form.get("code")!);
    if (
      !attempt ||
      form.get("client_secret") !== "synthetic-secret" ||
      createHash("sha256")
        .update(form.get("code_verifier") ?? "")
        .digest("base64url") !== attempt.get("code_challenge")
    ) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: "invalid_grant" }));
      return;
    }
    const encode = (v: unknown) =>
      Buffer.from(JSON.stringify(v)).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const bodyJwt =
      encode({ alg: "RS256", kid: "test" }) +
      "." +
      encode({
        iss: issuer,
        sub: subject,
        email:
          fault === "email-missing"
            ? undefined
            : fault === "email-wrong"
              ? "someone.else@example.test"
              : claimEmail,
        email_verified:
          fault === "email-unverified"
            ? false
            : fault === "email-string"
              ? "true"
              : true,
        aud: fault === "audience" ? "wrong" : "test-client",
        nonce: fault === "nonce" ? "wrong" : attempt.get("nonce"),
        iat: now,
        exp: fault === "expired" ? now - 3600 : now + 300,
      });
    const signature = sign(
      "RSA-SHA256",
      Buffer.from(bodyJwt),
      keys.privateKey,
    ).toString("base64url");
    res.end(
      JSON.stringify({
        access_token: "synthetic-access",
        token_type: "Bearer",
        id_token:
          bodyJwt +
          "." +
          (fault === "signature" ? "A".repeat(signature.length) : signature),
      }),
    );
  } else {
    res.writeHead(404);
    res.end();
  }
});
before(async () => {
  assert.match(
    new URL(process.env.DATABASE_URL!).pathname,
    /^\/fakturapass_verify_\d+$/,
    "Only isolated verification databases are allowed",
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  issuer = `http://127.0.0.1:${address.port}/`;
  Object.assign(process.env, {
    AUTH_MODE: "oidc",
    OIDC_ISSUER: issuer,
    OIDC_CLIENT_ID: "test-client",
    OIDC_CLIENT_SECRET: "synthetic-secret",
    APP_ORIGIN: origin,
    FAKTURAPASS_ENV: "LOCAL",
    LOCAL_BROWSER_IDENTITY: "enabled",
  });
  actor = principalActor(issuer, subject);
  await pool.query(
    "INSERT INTO memberships(id,tenant_id,user_subject,role,status) VALUES($1,'local-demo','workspace-tab-target','READ_ONLY','ACTIVE')",
    [randomUUID()],
  );
  await pool.query(
    "INSERT INTO memberships(id,tenant_id,user_subject,role,status) VALUES($1,'local-demo',$2,'ADMIN','ACTIVE')",
    [randomUUID(), actor],
  );
});
after(async () => {
  web?.kill("SIGTERM");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});
function call(
  path: string,
  method = "GET",
  cookie = "",
  requestOrigin = origin,
  workspace = "local-demo",
) {
  const req = new Request(origin + "/api/v1/" + path, {
    method,
    headers: {
      cookie,
      origin: requestOrigin,
      ...(workspace ? { "X-Workspace-Id": workspace } : {}),
    },
  });
  return (method === "GET" ? GET : POST)(req, {
    params: Promise.resolve({ path: path.split("?")[0].split("/") }),
  });
}
const cookieOf = (r: Response, kind: string) =>
  r.headers
    .getSetCookie()
    .find((v) => v.startsWith(`fakturapass-${kind}=`))
    ?.split(";")[0] ?? "";
async function attempt() {
  const start = await call("auth/login", "POST");
  assert.equal(start.status, 303);
  const auth = await fetch(start.headers.get("location")!, {
    redirect: "manual",
  });
  assert.equal(auth.status, 302);
  const callback = new URL(auth.headers.get("location")!);
  return {
    path: "auth/callback" + callback.search,
    cookie: cookieOf(start, "login"),
  };
}
async function login() {
  const a = await attempt();
  return call(a.path, "GET", a.cookie);
}
test("OIDC grants hashed sessions only to existing members and consumes callbacks once", async () => {
  const a = await attempt(),
    result = await call(a.path, "GET", a.cookie);
  assert.equal(result.headers.get("location"), origin + "/");
  const cookie = cookieOf(result, "session");
  assert(cookie);
  assert.match(result.headers.getSetCookie()[0], /HttpOnly; SameSite=Lax/);
  assert.equal((await call("invoices", "GET", cookie)).status, 200);
  assert.equal((await call("invoices")).status, 401);
  const rows = (await pool.query("SELECT token_sha256 FROM auth_sessions"))
    .rows;
  assert(!rows.some((row) => row.token_sha256 === cookie.split("=")[1]));
  assert.match(
    (await call(a.path, "GET", a.cookie)).headers.get("location")!,
    /error=failed/,
  );
  assert.equal(
    (await call("auth/logout", "POST", cookie, "https://attacker.invalid"))
      .status,
    403,
  );
  assert.equal((await call("auth/logout", "POST", cookie)).status, 303);
  assert.equal((await call("invoices", "GET", cookie)).status, 401);
});
test("OIDC rejects invalid state, nonce, audience, signature and expired ID tokens", async () => {
  const a = await attempt();
  assert.match(
    (
      await call(a.path.replace(/state=[^&]+/, "state=wrong"), "GET", a.cookie)
    ).headers.get("location")!,
    /error=failed/,
  );
  for (const invalid of ["nonce", "audience", "signature", "expired"]) {
    fault = invalid;
    const r = await login();
    assert.match(r.headers.get("location")!, /error=failed/, invalid);
    assert.equal(cookieOf(r, "session"), "");
  }
  fault = "";
});
test("Membership suspension, session expiry and authority changes revoke access", async () => {
  const cookie = cookieOf(await login(), "session");
  assert(cookie);
  await pool.query(
    "UPDATE memberships SET status='SUSPENDED' WHERE user_subject=$1",
    [actor],
  );
  assert.equal((await call("invoices", "GET", cookie)).status, 403);
  await pool.query(
    "UPDATE memberships SET status='ACTIVE' WHERE user_subject=$1",
    [actor],
  );
  process.env.OIDC_CLIENT_ID = "other";
  assert.equal((await call("invoices", "GET", cookie)).status, 401);
  process.env.OIDC_CLIENT_ID = "test-client";
  await pool.query(
    "UPDATE auth_sessions SET expires_at=now()-interval '1 second'",
  );
  assert.equal((await call("invoices", "GET", cookie)).status, 401);
  subject = "unprovisioned";
  assert.match((await login()).headers.get("location")!, /error=access/);
  subject = "approved-user";
});
test("Expired login and missing browser binding fail closed; multiple memberships require a choice", async () => {
  const a = await attempt();
  assert.match((await call(a.path)).headers.get("location")!, /error=failed/);
  await pool.query(
    "UPDATE oidc_login_transactions SET expires_at=now()-interval '1 second'",
  );
  assert.match(
    (await call(a.path, "GET", a.cookie)).headers.get("location")!,
    /error=failed/,
  );
  const cookie = cookieOf(await login(), "session");
  assert.equal(
    (await call("invoices", "GET", cookie + "; " + cookie)).status,
    401,
  );
  assert.equal(
    (await call("invoices", "POST", cookie, "https://attacker.invalid")).status,
    403,
  );
  await pool.query(
    "INSERT INTO memberships(id,tenant_id,user_subject,role,status) VALUES($1,'local-test-b',$2,'READ_ONLY','ACTIVE')",
    [randomUUID(), actor],
  );
  assert.equal((await login()).headers.get("location"), origin + "/workspaces");
  await pool.query(
    "UPDATE memberships SET status='SUSPENDED' WHERE tenant_id='local-test-b' AND user_subject=$1",
    [actor],
  );
});
test("Explicit workspace requests isolate tabs, permissions and suspended memberships", async () => {
  await pool.query(
    "UPDATE memberships SET status='ACTIVE' WHERE tenant_id='local-test-b' AND user_subject=$1",
    [actor],
  );
  const result = await login(),
    cookie = cookieOf(result, "session");
  assert.equal(result.headers.get("location"), origin + "/workspaces");
  const available = await (await call("auth/workspaces", "GET", cookie)).json();
  assert.deepEqual(
    available.items.map((item: { id: string }) => item.id).sort(),
    ["local-demo", "local-test-b"],
  );
  assert.equal(
    (await call("memberships", "GET", cookie, origin, "local-demo")).status,
    200,
  );
  assert.equal(
    (await call("memberships", "GET", cookie, origin, "local-test-b")).status,
    403,
  );
  assert.equal(
    (await call("invoices", "GET", cookie, origin, "unknown")).status,
    403,
  );
  assert.equal((await call("invoices", "GET", cookie, origin, "")).status, 403);
  assert.equal(
    (
      await call(
        "invoices?workspace=local-test-b",
        "GET",
        cookie,
        origin,
        "local-demo",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "invoices?workspace=local-test-b&workspace=local-demo",
        "GET",
        cookie,
        origin,
        "",
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("invoices?workspace=local-test-b", "GET", cookie, origin, ""))
      .status,
    200,
  );
  await pool.query(
    "UPDATE memberships SET status='SUSPENDED' WHERE tenant_id='local-demo' AND user_subject=$1",
    [actor],
  );
  assert.equal((await call("invoices", "GET", cookie)).status, 403);
  assert.equal(
    (await call("invoices", "GET", cookie, origin, "local-test-b")).status,
    200,
  );
  assert.equal(
    (await (await call("auth/workspaces", "GET", cookie)).json()).items.length,
    1,
  );
  await pool.query(
    "UPDATE memberships SET status='SUSPENDED' WHERE user_subject=$1",
    [actor],
  );
  assert.equal(
    (await (await call("auth/workspaces", "GET", cookie)).json()).items.length,
    0,
  );
  assert.equal(
    (await call("invoices?workspace=local-test-b", "POST", cookie, origin, ""))
      .status,
    403,
  );
  await pool.query(
    "UPDATE memberships SET status=CASE WHEN tenant_id='local-demo' THEN 'ACTIVE' ELSE 'SUSPENDED' END WHERE user_subject=$1",
    [actor],
  );
});
async function invitationCall(
  path: string,
  data: unknown,
  cookie = "",
  workspace = "local-demo",
) {
  const req = new Request(origin + "/api/v1/" + path, {
    method: "POST",
    headers: {
      origin,
      cookie,
      "X-Workspace-Id": workspace,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return POST(req, { params: Promise.resolve({ path: path.split("/") }) });
}
async function invitation(
  cookie: string,
  email = claimEmail,
  role = "READ_ONLY",
) {
  const response = await invitationCall("invitations", { email, role }, cookie);
  assert.equal(response.status, 201);
  const result = await response.json();
  return { ...result, token: new URL(result.url).hash.slice(1) };
}
async function joinAttempt(token: string) {
  const request = new Request(origin + "/api/v1/auth/join", {
    method: "POST",
    headers: { origin, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  });
  const response = await POST(request, {
    params: Promise.resolve({ path: ["auth", "join"] }),
  });
  assert.equal(response.status, 303);
  assert(!response.headers.get("location")!.includes("error="));
  const auth = await fetch(response.headers.get("location")!, {
    redirect: "manual",
  });
  const callback = new URL(auth.headers.get("location")!);
  return {
    path: "auth/callback" + callback.search,
    cookie: cookieOf(response, "login"),
  };
}
async function redeem(token: string) {
  const attempt = await joinAttempt(token);
  return call(attempt.path, "GET", attempt.cookie);
}
test("Organization bootstrap creates an audited administrator atomically and refuses overwrite", async () => {
  const result = await bootstrapOrganization(
    "invitation-bootstrap",
    "  Studio North  ",
    "https://issuer.example.test/",
    "verified-founder",
  );
  assert.equal(
    (
      await pool.query("SELECT name FROM tenants WHERE id=$1", [
        result.tenantId,
      ])
    ).rows[0].name,
    "Studio North",
  );
  assert.equal(
    (
      await pool.query(
        "SELECT role FROM memberships WHERE tenant_id=$1 AND user_subject=$2",
        [result.tenantId, result.actor],
      )
    ).rows[0].role,
    "ADMIN",
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM audit_events WHERE tenant_id=$1 AND action='ORGANIZATION_CREATE'",
        [result.tenantId],
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(
    bootstrapOrganization(
      "invitation-bootstrap",
      "Changed",
      "https://issuer.example.test/",
      "other-founder",
    ),
  );
  await assert.rejects(
    bootstrapOrganization(
      "invalid-bootstrap",
      "Studio",
      "http://issuer.example.test/",
      "subject",
    ),
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM memberships WHERE tenant_id=$1",
        [result.tenantId],
      )
    ).rows[0].n,
    1,
  );
});
test("Invitations are admin-only, hash-only, replaceable, expiring, revocable and authority-bound", async () => {
  const cookie = cookieOf(await login(), "session");
  assert.equal(
    (
      await invitationCall(
        "invitations",
        { email: "bad", role: "ADMIN" },
        cookie,
      )
    ).status,
    400,
  );
  await pool.query(
    "UPDATE memberships SET role='READ_ONLY' WHERE user_subject=$1 AND tenant_id='local-demo'",
    [actor],
  );
  assert.equal(
    (
      await invitationCall(
        "invitations",
        { email: claimEmail, role: "ADMIN" },
        cookie,
      )
    ).status,
    403,
  );
  await pool.query(
    "UPDATE memberships SET role='ADMIN' WHERE user_subject=$1 AND tenant_id='local-demo'",
    [actor],
  );
  const first = await invitation(cookie),
    second = await invitation(cookie);
  assert.equal(
    (await invitationCall("auth/invitation", { token: first.token })).status,
    403,
  );
  assert.equal(
    (await invitationCall("auth/invitation", { token: second.token })).status,
    200,
  );
  const listed = await (await call("invitations", "GET", cookie)).json();
  assert(!JSON.stringify(listed).includes(second.token));
  const stored = (
    await pool.query(
      "SELECT token_sha256 FROM organization_invitations WHERE id=$1",
      [second.id],
    )
  ).rows[0];
  assert.equal(
    stored.token_sha256,
    createHash("sha256").update(second.token).digest("hex"),
  );
  assert.equal(
    (
      await invitationCall(
        "invitations/" + second.id,
        {},
        cookie,
        "local-test-b",
      )
    ).status,
    403,
  );
  process.env.OIDC_CLIENT_ID = "other-client";
  assert.equal(
    (await invitationCall("auth/invitation", { token: second.token })).status,
    403,
  );
  process.env.OIDC_CLIENT_ID = "test-client";
  await pool.query(
    "UPDATE organization_invitations SET expires_at=now()-interval '1 second' WHERE id=$1",
    [second.id],
  );
  assert.equal(
    (await invitationCall("auth/invitation", { token: second.token })).status,
    403,
  );
  const revoked = await invitation(cookie);
  await invitationCall("invitations/" + revoked.id, {}, cookie);
  assert.equal(
    (await invitationCall("auth/invitation", { token: revoked.token })).status,
    403,
  );
  const pending = await invitation(cookie);
  const attempt = await joinAttempt(pending.token);
  await invitationCall("invitations/" + pending.id, {}, cookie);
  assert.match(
    (await call(attempt.path, "GET", attempt.cookie)).headers.get("location")!,
    /error=invitation/,
  );
});
test("Invitation acceptance requires verified matching email and cannot elevate or revive existing membership", async () => {
  const cookie = cookieOf(await login(), "session");
  const offered = await invitation(cookie, claimEmail, "OPERATOR");
  subject = "invited-unit";
  try {
    for (const invalid of [
      "email-unverified",
      "email-string",
      "email-missing",
      "email-wrong",
    ]) {
      fault = invalid;
      assert.match(
        (await redeem(offered.token)).headers.get("location")!,
        /error=invitation/,
      );
    }
    fault = "";
    const joined = await redeem(offered.token);
    assert.equal(joined.headers.get("location"), origin + "/");
    const invitedActor = principalActor(issuer, subject);
    assert.equal(
      (
        await pool.query("SELECT role FROM memberships WHERE user_subject=$1", [
          invitedActor,
        ])
      ).rows[0].role,
      "OPERATOR",
    );
    assert.equal(
      (await invitationCall("auth/invitation", { token: offered.token }))
        .status,
      403,
    );
    const higher = await invitation(cookie, claimEmail, "ADMIN");
    await redeem(higher.token);
    assert.equal(
      (
        await pool.query("SELECT role FROM memberships WHERE user_subject=$1", [
          invitedActor,
        ])
      ).rows[0].role,
      "OPERATOR",
    );
    await pool.query(
      "UPDATE memberships SET status='SUSPENDED' WHERE user_subject=$1",
      [invitedActor],
    );
    const suspended = await invitation(cookie);
    assert.match(
      (await redeem(suspended.token)).headers.get("location")!,
      /error=invitation/,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT status FROM memberships WHERE user_subject=$1",
          [invitedActor],
        )
      ).rows[0].status,
      "SUSPENDED",
    );
  } finally {
    subject = "approved-user";
    fault = "";
  }
});
test("Concurrent invitation callbacks grant membership once; demoted issuers cannot grant access", async () => {
  const cookie = cookieOf(await login(), "session"),
    offered = await invitation(cookie, "race@example.test");
  subject = "invited-race";
  claimEmail = "race@example.test";
  try {
    const a = await joinAttempt(offered.token),
      b = await joinAttempt(offered.token);
    const results = await Promise.all([
      call(a.path, "GET", a.cookie),
      call(b.path, "GET", b.cookie),
    ]);
    assert.equal(
      results.filter((r) => r.headers.get("location") === origin + "/").length,
      1,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM audit_events WHERE action='INVITATION_ACCEPT' AND resource_id=$1",
          [offered.id],
        )
      ).rows[0].n,
      1,
    );
    const stale = await invitation(cookie);
    const pending = await joinAttempt(stale.token);
    await pool.query(
      "UPDATE memberships SET role='OPERATOR' WHERE user_subject=$1 AND tenant_id='local-demo'",
      [actor],
    );
    assert.match(
      (await call(pending.path, "GET", pending.cookie)).headers.get(
        "location",
      )!,
      /error=invitation/,
    );
  } finally {
    await pool.query(
      "UPDATE memberships SET role='ADMIN' WHERE user_subject=$1 AND tenant_id='local-demo'",
      [actor],
    );
    subject = "approved-user";
    claimEmail = "new.member@example.test";
  }
});
async function keyCall(
  secret: string,
  path = "invoices",
  method = "GET",
  headers: Record<string, string> = {},
  payload: unknown = {},
) {
  const req = new Request(origin + "/api/v1/" + path, {
    method,
    headers: { "X-API-Key": secret, ...headers },
    ...(method === "POST" ? { body: JSON.stringify(payload) } : {}),
  });
  return (method === "GET" ? GET : POST)(req, {
    params: Promise.resolve({ path: path.split("?")[0].split("/") }),
  });
}
test("API credentials are scoped, hash-only, workspace-bound and cannot administer access", async () => {
  const cookie = cookieOf(await login(), "session");
  const created = await invitationCall(
    "api-credentials",
    { name: "Accounting export", scopes: ["invoices:read"], expiresInDays: 30 },
    cookie,
  );
  assert.equal(created.status, 201);
  const key = await created.json();
  assert.match(key.secret, /^fp_[A-Za-z0-9_-]{43}$/);
  const stored = (
    await pool.query("SELECT * FROM api_credentials WHERE id=$1", [key.id])
  ).rows[0];
  assert.equal(
    stored.token_sha256,
    createHash("sha256").update(key.secret).digest("hex"),
  );
  assert(!JSON.stringify(stored).includes(key.secret));
  assert.equal((await keyCall(key.secret)).status, 200);
  for (const path of [
    "api-credentials",
    "auth/workspaces",
    "memberships",
    "invitations",
    "unknown",
  ])
    assert.equal((await keyCall(key.secret, path)).status, 403);
  for (const path of [
    "invoices",
    "csv/preview",
    "csv/import",
    "invoices/x/revisions",
    "invoices/x/revisions/y/validate",
    "invoices/x/revisions/y/approve",
    "invoices/x/revisions/y/generate",
    "recipient-profiles",
    "review-queue/x/assignment",
  ])
    assert.equal((await keyCall(key.secret, path, "POST")).status, 403);
  assert.equal(
    (
      await keyCall(key.secret, "invoices", "GET", {
        "X-Workspace-Id": "local-test-b",
      })
    ).status,
    403,
  );
  assert.equal(
    (await keyCall(key.secret, "invoices?workspace=local-test-b")).status,
    403,
  );
  assert.equal(
    (await keyCall("invalid", "invoices", "GET", { cookie })).status,
    401,
  );
  const listed = await (await call("api-credentials", "GET", cookie)).json();
  assert(!JSON.stringify(listed).includes(key.secret));
  assert(listed.items.find((item: any) => item.id === key.id).lastUsedAt);
  const audit = (
    await pool.query(
      "SELECT metadata_json FROM audit_events WHERE resource_id=$1 AND action='API_CREDENTIAL_USE'",
      [key.id],
    )
  ).rows;
  assert(audit.length > 0);
  assert(!JSON.stringify(audit).includes(key.secret));
  for (const bad of [
    { scopes: ["admin"] },
    { scopes: [] },
    { expiresInDays: 91 },
    { scopes: ["invoices:read", "invoices:read"] },
  ])
    assert.equal(
      (
        await invitationCall(
          "api-credentials",
          {
            name: "Invalid",
            scopes: ["invoices:read"],
            expiresInDays: 30,
            ...bad,
          },
          cookie,
        )
      ).status,
      400,
    );
  assert.equal(
    (
      await invitationCall(
        "api-credentials",
        { name: "Denied", scopes: ["invoices:read"], expiresInDays: 30 },
        cookie,
        "local-test-b",
      )
    ).status,
    403,
  );
});
test("API credential rotation is atomic, preserves grants, and rejects stale versions and revoked keys", async () => {
  const cookie = cookieOf(await login(), "session");
  const key = await (
    await invitationCall(
      "api-credentials",
      { name: "Rotation", scopes: ["invoices:read"], expiresInDays: 1 },
      cookie,
    )
  ).json();
  const results = await Promise.all(
    [1, 2].map(() =>
      invitationCall(
        `api-credentials/${key.id}/rotate`,
        { expectedVersion: 1 },
        cookie,
      ),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const rotated = await results.find((r) => r.status === 200)!.json();
  assert.equal(rotated.expiresAt, key.expiresAt);
  assert.deepEqual(rotated.scopes, key.scopes);
  assert.equal((await keyCall(key.secret)).status, 401);
  assert.equal((await keyCall(rotated.secret)).status, 200);
  assert.equal(
    (
      await invitationCall(
        `api-credentials/${key.id}/revoke`,
        { expectedVersion: 1 },
        cookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await invitationCall(
        `api-credentials/${key.id}/revoke`,
        { expectedVersion: 2 },
        cookie,
      )
    ).status,
    200,
  );
  assert.equal((await keyCall(rotated.secret)).status, 401);
  assert.equal(
    (
      await invitationCall(
        `api-credentials/${key.id}/rotate`,
        { expectedVersion: 3 },
        cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await invitationCall(
        `api-credentials/${key.id}/revoke`,
        { expectedVersion: 3 },
        cookie,
        "local-test-b",
      )
    ).status,
    403,
  );
});
test("API credentials enforce expiry, configuration binding and current membership role", async () => {
  const cookie = cookieOf(await login(), "session");
  const key = await (
    await invitationCall(
      "api-credentials",
      {
        name: "Authority",
        scopes: ["invoices:read", "invoices:import"],
        expiresInDays: 1,
      },
      cookie,
    )
  ).json();
  const client = process.env.OIDC_CLIENT_ID;
  process.env.OIDC_CLIENT_ID = "changed";
  assert.equal((await keyCall(key.secret)).status, 401);
  process.env.OIDC_CLIENT_ID = client;
  await pool.query(
    "UPDATE memberships SET role='READ_ONLY' WHERE tenant_id='local-demo' AND user_subject=$1",
    [actor],
  );
  try {
    assert.equal((await keyCall(key.secret)).status, 200);
    assert.equal(
      (
        await keyCall(key.secret, "invoices", "POST", {
          "content-type": "application/json",
          "idempotency-key": "role-ceiling",
        })
      ).status,
      403,
    );
    await pool.query(
      "UPDATE memberships SET status='SUSPENDED' WHERE tenant_id='local-demo' AND user_subject=$1",
      [actor],
    );
    assert.equal((await keyCall(key.secret)).status, 403);
  } finally {
    await pool.query(
      "UPDATE memberships SET role='ADMIN',status='ACTIVE' WHERE tenant_id='local-demo' AND user_subject=$1",
      [actor],
    );
  }
  await pool.query(
    "UPDATE api_credentials SET expires_at=now()-interval '1 second' WHERE id=$1",
    [key.id],
  );
  assert.equal((await keyCall(key.secret)).status, 401);
  assert.equal(
    (
      await invitationCall(
        `api-credentials/${key.id}/rotate`,
        { expectedVersion: 1 },
        cookie,
      )
    ).status,
    403,
  );
});
test("Machine credentials import idempotently without browser origin and preserve tenant isolation", async () => {
  const cookie = cookieOf(await login(), "session");
  const input = {
    name: "Machine import",
    scopes: ["invoices:read", "invoices:import"],
    expiresInDays: 7,
  };
  const key = await (
    await invitationCall("api-credentials", input, cookie)
  ).json();
  const invoice = JSON.parse(
    readFileSync("fixtures/valid/FP-A-001.json", "utf8"),
  );
  invoice.source.recordId = randomUUID();
  const headers = {
    "content-type": "application/json",
    "idempotency-key": randomUUID(),
  };
  const response = await keyCall(
    key.secret,
    "invoices",
    "POST",
    headers,
    invoice,
  );
  assert.equal(response.status, 201);
  const created = await response.json();
  const replay = await keyCall(
    key.secret,
    "invoices",
    "POST",
    headers,
    invoice,
  );
  assert.equal(replay.status, 201);
  assert.deepEqual(await replay.json(), created);
  await pool.query(
    "UPDATE memberships SET role='ADMIN',status='ACTIVE' WHERE tenant_id='local-test-b' AND user_subject=$1",
    [actor],
  );
  try {
    const otherResponse = await invitationCall(
      "api-credentials",
      input,
      cookie,
      "local-test-b",
    );
    assert.equal(otherResponse.status, 201);
    const other = await otherResponse.json();
    assert.equal(
      (await keyCall(other.secret, `invoices/${created.invoiceId}`)).status,
      404,
    );
    assert.equal(
      (
        await invitationCall(
          `api-credentials/${key.id}/revoke`,
          { expectedVersion: 1 },
          cookie,
          "local-test-b",
        )
      ).status,
      404,
    );
    await pool.query(
      "UPDATE api_credentials SET environment='SANDBOX' WHERE id=$1",
      [key.id],
    );
    assert.equal((await keyCall(key.secret)).status, 401);
  } finally {
    await pool.query(
      "UPDATE memberships SET role='READ_ONLY',status='SUSPENDED' WHERE tenant_id='local-test-b' AND user_subject=$1",
      [actor],
    );
  }
});
async function supportFixture(suffix: string) {
  const ownerCookie = cookieOf(await login(), "session");
  const specialist = `support-${suffix}`;
  const agent = await registerSupportAgent(
    issuer,
    specialist,
    `Support ${suffix}`,
  );
  const invoice = JSON.parse(
    readFileSync("fixtures/valid/FP-A-001.json", "utf8"),
  );
  invoice.source.recordId = randomUUID();
  invoice.document.number = `SUP-${suffix}`;
  const response = await POST(
    new Request(origin + "/api/v1/invoices", {
      method: "POST",
      headers: {
        origin,
        cookie: ownerCookie,
        "X-Workspace-Id": "local-demo",
        "content-type": "application/json",
        "idempotency-key": randomUUID(),
      },
      body: JSON.stringify(invoice),
    }),
    { params: Promise.resolve({ path: ["invoices"] }) },
  );
  assert.equal(response.status, 201);
  const created = await response.json();
  const finding = {
    code: "VALIDATION_FAILED",
    severity: "ERROR",
    layer: "STANDARD",
    canonicalPath: "seller.contact.telephone",
    sourcePath: null,
    ruleId: "BR-DE-6",
    messageKey: "VALIDATION_FAILED",
    parameters: { message: "Synthetic support diagnostic" },
    evidenceSource: "synthetic-support-fixture",
  };
  await pool.query(
    "INSERT INTO validation_runs(id,tenant_id,revision_id,rule_manifest_json,engine_version,status,kind,canonical_sha256,dedupe_key,findings,completed_at) VALUES($1,'local-demo',$2,'{}','synthetic-support-validator','INVALID','PRECHECK',$3,$1,$4,now())",
    [
      randomUUID(),
      created.revisionId,
      created.canonicalSha256,
      JSON.stringify([finding]),
    ],
  );

  const input = {
    agentId: agent.id,
    invoiceId: created.invoiceId,
    revisionId: created.revisionId,
    reason: `Case ${suffix}`,
    hours: 1,
    consent: true,
  };
  return { ownerCookie, specialist, agent, invoice, created, input };
}
async function specialistLogin(specialist: string) {
  subject = specialist;
  try {
    return await login();
  } finally {
    subject = "approved-user";
  }
}
test("Support registration grants no access; administrators must consent to a tenant-scoped revision", async () => {
  const f = await supportFixture("consent");
  assert.match(
    (await specialistLogin(f.specialist)).headers.get("location")!,
    /error=access/,
  );
  await assert.rejects(() =>
    registerSupportAgent(issuer, f.specialist, "Duplicate"),
  );
  for (const patch of [
    { consent: false },
    { hours: 0 },
    { hours: 25 },
    { scope: "ADMIN" },
    { revisionId: randomUUID() },
    { invoiceId: randomUUID() },
  ]) {
    const response = await invitationCall(
      "support-grants",
      { ...f.input, ...patch },
      f.ownerCookie,
    );
    assert.equal(
      response.status,
      "invoiceId" in patch || "revisionId" in patch ? 404 : 400,
    );
  }
  assert.equal(
    (
      await invitationCall(
        "support-grants",
        f.input,
        f.ownerCookie,
        "local-test-b",
      )
    ).status,
    403,
  );
  const granted = await invitationCall(
    "support-grants",
    f.input,
    f.ownerCookie,
  );
  assert.equal(granted.status, 201);
  const key = await (
    await invitationCall(
      "api-credentials",
      {
        name: "Cannot grant support",
        scopes: ["invoices:read"],
        expiresInDays: 1,
      },
      f.ownerCookie,
    )
  ).json();
  for (const path of ["support-agents", "support-grants", "support/cases"])
    assert.equal((await keyCall(key.secret, path)).status, 403);
  const agentEvent = (
    await pool.query("SELECT id FROM support_agent_events WHERE agent_id=$1", [
      f.agent.id,
    ])
  ).rows[0];
  await assert.rejects(() =>
    pool.query("DELETE FROM support_agent_events WHERE id=$1", [agentEvent.id]),
  );
});
test("Support sessions read only the shared immutable revision and record specialist attribution", async () => {
  const f = await supportFixture("diagnosis");
  const grant = await (
    await invitationCall("support-grants", f.input, f.ownerCookie)
  ).json();
  const signed = await specialistLogin(f.specialist);
  assert.equal(signed.headers.get("location"), origin + "/support");
  const cookie = cookieOf(signed, "session");
  assert(cookie);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int n FROM memberships WHERE user_subject=$1",
        [principalActor(issuer, f.specialist)],
      )
    ).rows[0].n,
    0,
  );
  const list = await (await call("support/cases", "GET", cookie)).json();
  assert.deepEqual(
    list.items.map((g: any) => g.id),
    [grant.id],
  );
  const read = await call(`support/cases/${grant.id}`, "GET", cookie);
  assert.equal(read.status, 200);
  const diagnosis = await read.json();
  assert.deepEqual(diagnosis.revision.canonical, f.invoice);
  assert.equal(diagnosis.validationRuns[0].findings[0].ruleId, "BR-DE-6");
  assert(!("sourceArtifact" in diagnosis.revision));
  for (const path of [
    "invoices",
    `invoices/${f.created.invoiceId}`,
    "memberships",
    "api-credentials",
    "invitations",
    "artifacts/unknown/download",
  ]) {
    assert.equal((await call(path, "GET", cookie)).status, 403);
  }
  assert.equal(
    (await call(`support/cases/${grant.id}`, "POST", cookie)).status,
    403,
  );
  assert.equal(
    (await call(`support/cases/${grant.id}`, "GET", f.ownerCookie)).status,
    403,
  );
  assert.equal(
    (await call("support/cases/" + randomUUID(), "GET", cookie)).status,
    403,
  );
  const corrected = structuredClone(f.invoice);
  corrected.document.buyerReference = "CHANGED-AFTER-GRANT";
  const correction = await invitationCall(
    `invoices/${f.created.invoiceId}/revisions`,
    { priorRevisionId: f.created.revisionId, canonical: corrected },
    f.ownerCookie,
  );
  assert.equal(correction.status, 201);
  const again = await (
    await call(`support/cases/${grant.id}`, "GET", cookie)
  ).json();
  assert.equal(
    again.revision.canonical.document.buyerReference,
    f.invoice.document.buyerReference,
  );
  const events = (
    await pool.query(
      "SELECT actor_subject,metadata_json FROM audit_events WHERE resource_id=$1 AND action='SUPPORT_DIAGNOSIS_VIEW'",
      [grant.id],
    )
  ).rows;
  assert(events.length >= 2);
  assert(
    events.every(
      (e) =>
        e.actor_subject === principalActor(issuer, f.specialist) &&
        e.metadata_json.revisionId === f.created.revisionId,
    ),
  );
  assert(
    (
      await (await call("support-grants", "GET", f.ownerCookie)).json()
    ).items.find((g: any) => g.id === grant.id).lastViewedAt,
  );
});
test("Support expiry, revocation, authorizer demotion and environment binding stop subsequent reads", async () => {
  const f = await supportFixture("expiry");
  const grant = await (
    await invitationCall("support-grants", f.input, f.ownerCookie)
  ).json();
  const cookie = cookieOf(await specialistLogin(f.specialist), "session");
  const path = `support/cases/${grant.id}`;
  assert.deepEqual(
    (
      await Promise.all([call(path, "GET", cookie), call(path, "GET", cookie)])
    ).map((r) => r.status),
    [200, 200],
  );
  await pool.query(
    "UPDATE memberships SET role='OPERATOR' WHERE tenant_id='local-demo' AND user_subject=$1",
    [actor],
  );
  try {
    assert.equal((await call(path, "GET", cookie)).status, 403);
    assert.deepEqual(
      (await (await call("support/cases", "GET", cookie)).json()).items,
      [],
    );
  } finally {
    await pool.query(
      "UPDATE memberships SET role='ADMIN' WHERE tenant_id='local-demo' AND user_subject=$1",
      [actor],
    );
  }
  await pool.query(
    "UPDATE support_grants SET environment='SANDBOX' WHERE id=$1",
    [grant.id],
  );
  assert.equal((await call(path, "GET", cookie)).status, 403);
  await pool.query(
    "UPDATE support_grants SET environment='LOCAL',expires_at=now()-interval '1 second' WHERE id=$1",
    [grant.id],
  );
  assert.equal((await call(path, "GET", cookie)).status, 403);
  const next = await (
    await invitationCall("support-grants", f.input, f.ownerCookie)
  ).json();
  assert.equal(
    (
      await invitationCall(
        `support-grants/${next.id}/revoke`,
        {},
        f.ownerCookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await call(`support/cases/${next.id}`, "GET", cookie)).status,
    403,
  );
  assert.match(
    (await specialistLogin(f.specialist)).headers.get("location")!,
    /error=access/,
  );
});
test("Specialist offboarding revokes all grants and a suspended customer identity cannot use support", async () => {
  const f = await supportFixture("offboarding");
  const grant = await (
    await invitationCall("support-grants", f.input, f.ownerCookie)
  ).json();
  const cookie = cookieOf(await specialistLogin(f.specialist), "session");
  await pool.query(
    "INSERT INTO memberships(id,tenant_id,user_subject,role,status) VALUES($1,'local-demo',$2,'READ_ONLY','SUSPENDED')",
    [randomUUID(), principalActor(issuer, f.specialist)],
  );
  assert.equal(
    (await call(`support/cases/${grant.id}`, "GET", cookie)).status,
    403,
  );
  assert.equal(
    (await invitationCall("support-grants", f.input, f.ownerCookie)).status,
    403,
  );
  await suspendSupportAgent(f.agent.id);
  assert(
    (
      await pool.query("SELECT revoked_at FROM support_grants WHERE id=$1", [
        grant.id,
      ])
    ).rows[0].revoked_at,
  );
  assert.equal(
    (await call(`support/cases/${grant.id}`, "GET", cookie)).status,
    403,
  );
  assert.match(
    (await specialistLogin(f.specialist)).headers.get("location")!,
    /error=access/,
  );
  assert(
    !(
      await (await call("support-agents", "GET", f.ownerCookie)).json()
    ).items.some((a: any) => a.id === f.agent.id),
  );
});
test("Production requires HTTPS and uses host-only secure cookies", () => {
  process.env.FAKTURAPASS_ENV = "PRODUCTION";
  assert.throws(settings);
  process.env.APP_ORIGIN = "https://app.example.test";
  process.env.OIDC_ISSUER = "https://identity.example.test/";
  assert.match(
    authCookie("session", "test", 60),
    /^__Host-fakturapass-session=.*; Secure$/,
  );
  Object.assign(process.env, {
    FAKTURAPASS_ENV: "LOCAL",
    APP_ORIGIN: origin,
    OIDC_ISSUER: issuer,
  });
});

for (const [name, browserType] of [
  ["Chromium", chromium],
  ["WebKit", webkit],
] as const) {
  test(`${name}: bilingual sign-in, workspace and sign-out`, async () => {
    if (!web) {
      web = spawn(
        process.execPath,
        [
          "node_modules/next/dist/bin/next",
          "start",
          "apps/web",
          "-p",
          "3012",
          "--hostname",
          "127.0.0.1",
        ],
        { env: process.env, stdio: "ignore" },
      );
      let ready = false;
      for (let n = 0; n < 60; n++) {
        try {
          if (
            (
              await fetch(origin + "/sign-in", {
                signal: AbortSignal.timeout(2000),
              })
            ).ok
          ) {
            ready = true;
            break;
          }
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      assert(ready, "OIDC web server ready");
    }
    await pool.query(
      "UPDATE memberships SET status='SUSPENDED' WHERE tenant_id='local-test-b' AND user_subject=$1",
      [actor],
    );
    const browser = await browserType.launch();
    try {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      const page = await context.newPage();
      await page.goto(origin);
      await expect(page).toHaveURL(/sign-in/);
      await page.getByRole("combobox").selectOption("en");
      await page.getByRole("button", { name: "Dark appearance" }).click();
      await page.screenshot({
        path: `test-results/oidc-sign-in-${name.toLowerCase()}.png`,
        fullPage: true,
      });
      const submitted = page.waitForRequest(
        (request) => request.url() === origin + "/api/v1/auth/login",
      );
      await page.getByRole("button", { name: "Sign in securely" }).click();
      assert.equal((await submitted).headers().origin, origin);
      await expect(
        page.getByRole("button", { name: "Sign out of FakturaPass" }),
      )
        .toBeVisible({ timeout: 15000 })
        .catch(async (error) => {
          throw new Error(
            `${error.message} URL=${page.url()} BODY=${await page.locator("body").innerText()}`,
          );
        });
      await pool.query(
        "UPDATE memberships SET status='ACTIVE' WHERE tenant_id='local-test-b' AND user_subject=$1",
        [actor],
      );
      const tabA = await page.context().newPage();
      const requestA = tabA.waitForRequest((r) =>
        r.url().includes("/api/v1/invoices"),
      );
      await tabA.goto(origin + "/?workspace=local-demo");
      assert.equal((await requestA).headers()["x-workspace-id"], "local-demo");
      await page.getByRole("link", { name: "Switch workspace" }).click();
      await expect(
        page.getByRole("heading", { name: "Choose your workspace" }),
      ).toBeVisible();
      await page.screenshot({
        path: `test-results/workspaces-${name.toLowerCase()}.png`,
        fullPage: true,
      });
      const requestB = page.waitForRequest((r) =>
        r.url().includes("/api/v1/invoices"),
      );
      await page.locator('a[href="/?workspace=local-test-b"]').click();
      assert.equal(
        (await requestB).headers()["x-workspace-id"],
        "local-test-b",
      );
      await expect(tabA).toHaveURL(/workspace=local-demo/);
      const tabARequest = tabA.waitForRequest((r) =>
        r.url().includes("/api/v1/memberships"),
      );
      await tabA
        .getByRole("button", { name: "Team access", exact: true })
        .click();
      assert.equal(
        (await tabARequest).headers()["x-workspace-id"],
        "local-demo",
      );
      const target = tabA.locator(".team-member").filter({
        has: tabA.getByRole("heading", {
          name: "workspace-tab-target",
          exact: true,
        }),
      });
      await target.getByLabel("Role", { exact: true }).selectOption("OPERATOR");
      const writeA = tabA.waitForRequest(
        (r) =>
          r.method() === "POST" && r.url().includes("/api/v1/memberships/"),
      );
      await target
        .getByRole("button", { name: "Save access", exact: true })
        .click();
      assert.equal((await writeA).headers()["x-workspace-id"], "local-demo");
      await expect(
        target.getByText("Operator · Active", { exact: true }),
      ).toBeVisible();
      const changed = (
        await pool.query(
          "SELECT tenant_id,role FROM memberships WHERE user_subject='workspace-tab-target'",
        )
      ).rows;
      assert.deepEqual(changed, [
        { tenant_id: "local-demo", role: "OPERATOR" },
      ]);
      await pool.query(
        "UPDATE memberships SET role='READ_ONLY' WHERE user_subject='workspace-tab-target'",
      );
      const invitationsPanel = tabA.locator("section").filter({
        has: tabA.getByRole("heading", {
          name: "Invite your team",
          exact: true,
        }),
      });
      const recipient = `browser-${name.toLowerCase()}@example.test`;
      await invitationsPanel
        .getByLabel("Email address", { exact: true })
        .fill(recipient);
      await invitationsPanel
        .getByRole("button", { name: "Create invitation link", exact: true })
        .click();
      const linkInput = invitationsPanel.getByLabel("Invitation link", {
        exact: true,
      });
      await expect(linkInput).toBeVisible();
      const inviteUrl = await linkInput.inputValue();
      const guestContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      await guestContext.addCookies([
        { name: "fakturapass-language", value: "en", url: origin },
        { name: "fakturapass-theme", value: "dark", url: origin },
      ]);
      subject = `browser-invite-${name}`;
      claimEmail = recipient;
      try {
        const guest = await guestContext.newPage();
        await guest.goto(inviteUrl);
        await expect(
          guest.getByRole("button", { name: "Sign in and join", exact: true }),
        ).toBeVisible();
        assert.equal(new URL(guest.url()).hash, "");
        await guest.screenshot({
          path: `test-results/invitation-${name.toLowerCase()}.png`,
          fullPage: true,
        });
        await guest
          .getByRole("button", { name: "Sign in and join", exact: true })
          .click();
        await expect(
          guest.getByRole("link", { name: "Switch workspace" }),
        ).toBeVisible();
        assert.equal(
          (
            await pool.query(
              "SELECT role FROM memberships WHERE user_subject=$1",
              [principalActor(issuer, subject)],
            )
          ).rows[0].role,
          "READ_ONLY",
        );
      } finally {
        subject = "approved-user";
        claimEmail = "new.member@example.test";
        await guestContext.close();
      }
      await invitationsPanel
        .getByRole("button", { name: "Refresh", exact: true })
        .click();
      await expect(
        invitationsPanel
          .locator("article")
          .filter({ hasText: recipient })
          .getByText(/Invitation accepted/),
      ).toBeVisible();
      const keysPanel = tabA.locator("section").filter({
        has: tabA.getByRole("heading", { name: "API access", exact: true }),
      });
      await keysPanel
        .getByLabel("Name", { exact: true })
        .fill(`Browser ${name}`);
      await keysPanel
        .getByRole("button", { name: "Create API key", exact: true })
        .click();
      const secretInput = keysPanel.getByLabel("New API key", { exact: true });
      await expect(secretInput).toBeVisible();
      const firstSecret = await secretInput.inputValue();
      assert.equal((await keyCall(firstSecret)).status, 200);
      await secretInput.evaluate((element) => {
        (element as HTMLInputElement).value = "[hidden for screenshot]";
      });
      await keysPanel.screenshot({
        path: `test-results/api-credentials-${name.toLowerCase()}.png`,
      });
      const keyCard = keysPanel
        .locator("article")
        .filter({ hasText: `Browser ${name}` });
      await keyCard
        .getByRole("button", { name: "Replace key", exact: true })
        .click();
      await keysPanel
        .getByRole("button", { name: "Confirm change", exact: true })
        .click();
      await expect(secretInput).not.toHaveValue(firstSecret);
      const secondSecret = await secretInput.inputValue();
      assert.equal((await keyCall(firstSecret)).status, 401);
      assert.equal((await keyCall(secondSecret)).status, 200);
      await keyCard
        .getByRole("button", { name: "Revoke access", exact: true })
        .click();
      await keysPanel
        .getByRole("button", { name: "Confirm change", exact: true })
        .click();
      await expect(keyCard.getByText(/Revoked/)).toBeVisible();
      assert.equal((await keyCall(secondSecret)).status, 401);
      await expect(secretInput).toHaveCount(0);
      const support = await supportFixture(`browser-${name}`);
      await tabA.reload();
      await tabA
        .getByRole("button", { name: "Team access", exact: true })
        .click();
      const supportPanel = tabA.locator("section").filter({
        has: tabA.getByRole("heading", {
          name: "Support access",
          exact: true,
        }),
      });
      await expect(supportPanel)
        .toBeVisible({ timeout: 5000 })
        .catch(async (error) => {
          throw Error(
            `${error.message} URL=${tabA.url()} BODY=${await tabA.locator("body").innerText()}`,
          );
        });
      await expect(
        supportPanel.getByLabel("Support specialist", { exact: true }),
      )
        .toBeVisible({ timeout: 5000 })
        .catch(async (error) => {
          throw Error(
            `${error.message} BODY=${await supportPanel.innerText()}`,
          );
        });
      await supportPanel
        .getByLabel("Support specialist", { exact: true })
        .selectOption(support.agent.id);
      await supportPanel
        .getByLabel("Shared invoice revision", { exact: true })
        .selectOption(support.created.revisionId);
      await supportPanel
        .getByLabel("Issue or ticket reference", { exact: true })
        .fill(`Browser assistance ${name}`);
      const allow = supportPanel.getByRole("button", {
        name: "Allow support access",
        exact: true,
      });
      await expect(allow).toBeDisabled();
      await supportPanel.getByRole("checkbox").check();
      await allow.click();
      await expect(supportPanel.getByRole("status")).toContainText(
        "Support access is granted",
      );
      const specialistContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      await specialistContext.addCookies([
        { name: "fakturapass-language", value: "en", url: origin },
        { name: "fakturapass-theme", value: "dark", url: origin },
      ]);
      subject = support.specialist;
      try {
        const specialist = await specialistContext.newPage();
        await specialist.goto(origin + "/support");
        await specialist
          .getByRole("button", { name: "Sign in securely", exact: true })
          .click();
        await expect(specialist).toHaveURL(origin + "/support");
        await specialist
          .locator(".support-case")
          .filter({ hasText: support.invoice.document.number })
          .click();
        await expect(specialist.locator(".invoice-review")).toBeVisible();
        await expect(
          specialist.getByRole("heading", {
            name: "Saved validation results",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          specialist.getByText("seller.contact.telephone", { exact: false }),
        ).toBeVisible();
        await specialist
          .getByText("Technical details", { exact: true })
          .click();
        await expect(
          specialist.getByText(/Synthetic support diagnostic/),
        ).toBeVisible();
        await specialist
          .getByLabel("Language", { exact: true })
          .selectOption("de");
        await expect(
          specialist.getByRole("heading", {
            name: "Supportfälle",
            exact: true,
          }),
        ).toBeVisible();
        await specialist
          .getByLabel("Sprache", { exact: true })
          .selectOption("en");
        await specialist.screenshot({
          path: `test-results/support-${name.toLowerCase()}.png`,
          fullPage: true,
        });
        await supportPanel
          .getByRole("button", { name: "Refresh", exact: true })
          .click();
        const shared = supportPanel
          .locator("article")
          .filter({ hasText: support.invoice.document.number });
        await expect(shared).not.toContainText("Not used yet");
        await shared
          .getByRole("button", { name: "Revoke support access", exact: true })
          .click();
        await expect(shared).toContainText("Revoked");
        await specialist
          .getByRole("button", { name: "Refresh", exact: true })
          .click();
        await expect(specialist.locator(".invoice-review")).toHaveCount(0);
        await expect(specialist.getByRole("status")).toContainText(
          "There are no shared support cases",
        );
      } finally {
        subject = "approved-user";
        await specialistContext.close();
      }
      await pool.query(
        "UPDATE memberships SET status='SUSPENDED' WHERE tenant_id='local-test-b' AND user_subject=$1",
        [actor],
      );
      await page.goto(origin + "/?workspace=local-test-b");
      await expect(page).toHaveURL(/workspaces/);
      await expect(
        page.locator('a[href="/?workspace=local-test-b"]'),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Sign out of FakturaPass" })
        .click();
      await expect(page.getByRole("status")).toHaveText(
        "You are signed out of FakturaPass.",
      );
      await page.goto(origin);
      await expect(page).toHaveURL(/sign-in/);
    } finally {
      await browser.close();
    }
  });
}
