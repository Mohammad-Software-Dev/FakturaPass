import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
const web = process.env.WEB_IMAGE ?? "fakturapass-web:packaging-check";
const worker = process.env.WORKER_IMAGE ?? "fakturapass-worker:packaging-check";
const docker = (...args) =>
  execFileSync("docker", args, { encoding: "utf8", timeout: 300000 }).trim();
const request = (url, options = {}) =>
  fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
const network = `fakturapass-container-${process.pid}`;
const ids = [];
const token = randomBytes(32).toString("base64url");
const password = randomBytes(32).toString("hex");
const common = [
  "--network",
  network,
  "--read-only",
  "--tmpfs",
  "/tmp:rw,noexec,nosuid,size=64m",
  "--cap-drop=ALL",
  "--security-opt=no-new-privileges",
  "-e",
  `DATABASE_URL=postgres://fakturapass:${password}@database:5432/acceptance`,
  "-e",
  "INVOICE_ENGINE_URL=http://validator:8089",
  "-e",
  "FAKTURAPASS_ENV=LOCAL",
  "-e",
  "AUTH_MODE=local",
  "-e",
  "LOCAL_BROWSER_IDENTITY=enabled",
  "-e",
  `OPERATIONS_TOKEN=${token}`,
];
async function until(fn) {
  for (let n = 0; n < 100; n++) {
    const result = await fn();
    if (result) return result;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw Error("Container readiness timed out");
}
try {
  execFileSync(process.execPath, ["scripts/setup-engine.mjs"], {
    stdio: "inherit",
    timeout: 300000,
  });
  docker(
    "build",
    "-q",
    "-t",
    "fakturapass-engine:container-check",
    "services/invoice-engine",
  );
  docker("network", "create", network);
  const database = docker(
    "run",
    "-d",
    "--network",
    network,
    "--network-alias",
    "database",
    "--tmpfs",
    "/var/lib/postgresql/data",
    "-e",
    "POSTGRES_USER=fakturapass",
    "-e",
    `POSTGRES_PASSWORD=${password}`,
    "-e",
    "POSTGRES_DB=acceptance",
    "postgres:17.9-alpine@sha256:c7526c0f6c3f30260a563d7bcf8ad778effac59a44f8ffa86678c35418338609",
  );
  ids.push(database);
  await until(async () => {
    try {
      docker(
        "exec",
        database,
        "pg_isready",
        "-U",
        "fakturapass",
        "-d",
        "acceptance",
      );
      return true;
    } catch {
      return false;
    }
  });
  const engine = docker(
    "run",
    "-d",
    "-i",
    "--network",
    network,
    "--network-alias",
    "validator",
    "--read-only",
    "--tmpfs",
    "/tmp",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "fakturapass-engine:container-check",
  );
  ids.push(engine);
  docker("run", "--rm", ...common, worker, "migrate");
  for (const image of [web, worker]) {
    const meta = JSON.parse(docker("image", "inspect", image))[0];
    assert.equal(meta.Config.User, "10001:10001");
    docker(
      "run",
      "--rm",
      "--entrypoint",
      "node",
      image,
      "-e",
      "const fs=require('node:fs'); for(const p of ['.env','.git','.data','node_modules/typescript','node_modules/sharp']) if(fs.existsSync('/app/'+p)) process.exit(1); for(const p of ['/usr/local/lib/node_modules/npm','/usr/local/lib/node_modules/corepack','/usr/local/bin/npm','/usr/local/bin/npx','/usr/local/bin/yarn','/usr/local/bin/corepack']) if(fs.existsSync(p)) process.exit(1); if(fs.existsSync('/app/node_modules/@img') && fs.readdirSync('/app/node_modules/@img').length) process.exit(1)",
    );
    assert.throws(
      () =>
        docker(
          "run",
          "--rm",
          ...common,
          "-e",
          "FAKTURAPASS_ENV=PRODUCTION",
          image,
        ),
      "Production must reject local identity overrides",
    );
    const sbom = JSON.parse(
      docker(
        "run",
        "--rm",
        "--entrypoint",
        "cat",
        image,
        "/app/release/npm-sbom.cdx.json",
      ),
    );
    assert.equal(sbom.bomFormat, "CycloneDX");
    assert(sbom.components.some((c) => c.name === "pg"));
    assert(!sbom.components.some((c) => c.name === "typescript"));

    assert.throws(
      () => docker("run", "--rm", image),
      "Missing runtime configuration must fail closed",
    );
  }
  const workerId = docker("run", "-d", ...common, worker);
  ids.push(workerId);
  const webId = docker("run", "-d", ...common, "-p", "127.0.0.1::3010", web);
  ids.push(webId);
  const port = docker("port", webId, "3010/tcp").split(":").at(-1);
  const base = `http://127.0.0.1:${port}`;
  await until(async () => {
    try {
      return (await request(base + "/api/v1/health/ready")).ok;
    } catch {
      return false;
    }
  });
  assert.equal((await request(base)).status, 200);
  assert.equal((await request(base + "/api/v1/operations/status")).status, 401);
  const status = await (
    await request(base + "/api/v1/operations/status", {
      headers: { "X-Operations-Token": token },
    })
  ).json();
  assert.equal(status.status, "healthy");
  assert.equal(
    (await request(base + "/_next/image?url=%2Ffavicon.ico&w=64&q=75")).status,
    404,
  );
  async function api(path, body) {
    const response = await request(base + "/api/v1/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        Origin: base,
        "Idempotency-Key": randomUUID(),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert(response.ok, `${path}: ${response.status}`);
    return response.json();
  }
  const invoice = JSON.parse(
    readFileSync("fixtures/valid/FP-A-001.json", "utf8"),
  );
  invoice.source.recordId = randomUUID();
  const imported = await api("invoices", invoice);
  const run = await api(
    `invoices/${imported.invoiceId}/revisions/${imported.revisionId}/validate`,
    {},
  );
  const result = await until(async () => {
    const r = await api(`validation-runs/${run.validationRunId}`);
    return ["PASS", "FAIL"].includes(r.status) ? r : null;
  });
  assert.equal(result.status, "PASS");
  execFileSync(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "tests/browser/import-review.spec.ts",
      "tests/browser/language.spec.ts",
      "tests/browser/theme.spec.ts",
    ],
    {
      stdio: "inherit",
      timeout: 300000,
      env: { ...process.env, PLAYWRIGHT_BASE_URL: base },
    },
  );
  docker("stop", "--time", "15", workerId);
  assert.equal(JSON.parse(docker("inspect", workerId))[0].State.ExitCode, 0);
  const stopped = await (
    await request(base + "/api/v1/operations/status", {
      headers: { "X-Operations-Token": token },
    })
  ).json();
  assert(stopped.alerts.includes("WORKER_MISSING"));
  assert.equal(stopped.workers.active, 0);
  assert(stopped.jobs.some((j) => j.outcome === "PASSED" && j.attempts === 1));
  console.log(
    "Container acceptance passed: non-root/read-only images, SBOM, configuration rejection, migration, web readiness, import/official validation, metrics, Chromium/WebKit import/language/theme journeys and graceful shutdown.",
  );
} finally {
  for (const id of ids.reverse()) docker("rm", "-f", "-v", id);
  try {
    docker("network", "rm", network);
  } catch {
    /* It may not have been created. */
  }
}
