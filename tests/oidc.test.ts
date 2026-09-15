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
  actor = "";
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
) {
  const req = new Request(origin + "/api/v1/" + path, {
    method,
    headers: { cookie, origin: requestOrigin },
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
test("Expired login, missing browser binding and ambiguous tenant access fail closed", async () => {
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
  assert.match((await login()).headers.get("location")!, /error=access/);
  await pool.query(
    "UPDATE memberships SET status='SUSPENDED' WHERE tenant_id='local-test-b' AND user_subject=$1",
    [actor],
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
    const browser = await browserType.launch();
    try {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      });
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
