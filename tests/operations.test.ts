import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import YAML from "yaml";
import { spawn } from "node:child_process";
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { pool } from "../packages/database";
import {
  operationsAuthorization,
  operationalStatus,
  operationsPool,
} from "../packages/operations/status";
import {
  observeRequest,
  requestMetrics,
} from "../packages/operations/telemetry";
import * as service from "../packages/domain/service";
import { GET } from "../apps/web/app/api/v1/[...path]/route";
const secret = "A".repeat(43);
const ctx: service.Context = {
  tenantId: "local-demo",
  actor: "ops-test",
  role: "ADMIN",
  environment: "SANDBOX",
  requestId: randomUUID(),
};
let oldEngine: string | undefined;
const healthy = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end("{}");
});
before(async () => {
  assert.match(
    new URL(process.env.DATABASE_URL!).pathname,
    /^\/fakturapass_verify_\d+$/,
  );
  oldEngine = process.env.INVOICE_ENGINE_URL;
  await new Promise<void>((resolve) => healthy.listen(0, "127.0.0.1", resolve));
  const address = healthy.address();
  assert(address && typeof address !== "string");
  process.env.INVOICE_ENGINE_URL = `http://127.0.0.1:${address.port}`;
  process.env.FAKTURAPASS_ENV = "SANDBOX";
});
after(async () => {
  if (oldEngine) process.env.INVOICE_ENGINE_URL = oldEngine;
  else delete process.env.INVOICE_ENGINE_URL;
  delete process.env.OPERATIONS_TOKEN;
  process.env.FAKTURAPASS_ENV = "LOCAL";
  await new Promise<void>((resolve) => healthy.close(() => resolve()));
  await operationsPool.end();
  await pool.end();
});
async function snapshotRequest(
  token?: string,
  headers: Record<string, string> = {},
) {
  return GET(
    new Request("http://localhost/api/v1/operations/status", {
      headers: {
        ...(token ? { "X-Operations-Token": token } : {}),
        ...headers,
      },
    }),
    { params: Promise.resolve({ path: ["operations", "status"] }) },
  );
}
async function enqueue() {
  const invoice = JSON.parse(
    readFileSync("fixtures/valid/FP-A-001.json", "utf8"),
  );
  invoice.source.recordId = randomUUID();
  invoice.totals.payableAmount = "999.00";
  const created = await service.ingest(
    ctx,
    invoice,
    Buffer.from(JSON.stringify(invoice)),
    randomUUID(),
  );
  await service.enqueueValidation(
    ctx,
    created.invoiceId,
    created.revisionId,
    null,
  );
  return created;
}
test("Operator endpoint is disabled by default and never accepts customer authentication", async () => {
  delete process.env.OPERATIONS_TOKEN;
  assert.equal((await snapshotRequest()).status, 404);
  process.env.OPERATIONS_TOKEN = "short";
  assert.equal((await snapshotRequest("short")).status, 404);
  process.env.OPERATIONS_TOKEN = secret;
  for (const headers of [
    {},
    { authorization: "Bearer " + secret },
    { "X-API-Key": secret },
    { cookie: "fakturapass-session=" + secret },
  ] as Record<string, string>[])
    assert.equal((await snapshotRequest(undefined, headers)).status, 401);
  assert.equal(
    (await snapshotRequest(secret, { authorization: "Bearer " + secret }))
      .status,
    401,
  );
  assert.equal(
    operationsAuthorization(
      new Request("http://localhost", {
        headers: { "X-Operations-Token": "B".repeat(43) },
      }),
    ),
    401,
  );
  const response = await snapshotRequest(secret);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const report = await response.json();
  assert(report.alerts.includes("WORKER_MISSING"));
  const ajv = new Ajv2020({ strict: false });
  addFormats(ajv);
  const spec = YAML.parse(
    readFileSync("packages/contracts/openapi.yaml", "utf8"),
  );
  const validate = ajv.compile(
    spec.paths["/operations/status"].get.responses["503"].content[
      "application/json"
    ].schema,
  );
  assert(validate(report), JSON.stringify(validate.errors));
});
test("Request metrics and logs use bounded operation labels and omit raw paths, headers and bodies", () => {
  const output: string[] = [];
  const original = console.log;
  process.env.OPERATIONS_REQUEST_LOGS = "enabled";
  console.log = (value) => output.push(String(value));
  try {
    for (let i = 0; i < 100; i++)
      observeRequest("GET", ["invoices", `private-bank-${i}`], 404, 25);
    observeRequest("GET", ["unknown", "customer@example.test"], 404, 12);
    observeRequest("POST", ["auth", "invitation"], 400, 18);
  } finally {
    console.log = original;
    delete process.env.OPERATIONS_REQUEST_LOGS;
  }
  const text = JSON.stringify(requestMetrics()) + output.join("");
  assert(!text.includes("private-bank"));
  assert(!text.includes("customer@"));
  assert(!text.includes(secret));
  const entry = requestMetrics().items.find(
    (r) => r.operation === "getInvoice" && r.statusClass === "4xx",
  )!;
  assert.equal(entry.count, 100);
  assert.equal(entry.buckets[0], 100);
  assert.equal(entry.durationMs, 2500);
  assert.equal(
    requestMetrics().items.filter((r) => r.operation === "getInvoice").length,
    1,
  );
  assert(output.every((line) => JSON.parse(line).observationId));
});
test("Operational snapshot detects stale workers, overdue queues, expired leases and engine outages without tenant data", async () => {
  const created = await enqueue();
  await pool.query(
    "UPDATE jobs SET created_at=now()-interval '10 minutes' WHERE environment='SANDBOX' AND payload_json->>'invoiceId'=$1",
    [created.invoiceId],
  );
  const worker = randomUUID();
  await pool.query(
    "INSERT INTO worker_heartbeats(id,environment,last_seen_at) VALUES($1,'SANDBOX',now()-interval '2 minutes')",
    [worker],
  );
  let report = await operationalStatus();
  assert(report.alerts.includes("WORKER_MISSING"));
  assert(report.alerts.includes("QUEUE_DELAYED"));
  assert.equal(report.queue.pending, 1);
  await pool.query(
    "UPDATE worker_heartbeats SET last_seen_at=now() WHERE id=$1",
    [worker],
  );
  await pool.query(
    "UPDATE jobs SET state='RUNNING',lease_until=now()-interval '1 second' WHERE environment='SANDBOX' AND payload_json->>'invoiceId'=$1",
    [created.invoiceId],
  );
  report = await operationalStatus();
  assert(!report.alerts.includes("WORKER_MISSING"));
  assert(report.alerts.includes("JOB_LEASE_EXPIRED"));
  const engine = process.env.INVOICE_ENGINE_URL;
  process.env.INVOICE_ENGINE_URL = "http://127.0.0.1:1";
  try {
    assert((await operationalStatus()).alerts.includes("ENGINE_UNAVAILABLE"));
  } finally {
    process.env.INVOICE_ENGINE_URL = engine;
  }
  assert(!JSON.stringify(report).includes(created.invoiceId));
  assert(!JSON.stringify(report).includes("local-demo"));
  assert(!JSON.stringify(report).includes("payload"));
  await pool.query(
    "UPDATE jobs SET state='PENDING',created_at=now(),lease_until=NULL WHERE environment='SANDBOX' AND payload_json->>'invoiceId'=$1",
    [created.invoiceId],
  );
});
test("Workers claim only their environment and durable outcomes count committed attempts once", async () => {
  // A PILOT worker must leave the due SANDBOX job untouched.
  process.env.FAKTURAPASS_ENV = "PILOT";
  try {
    assert.equal(await service.processJob(), false);
  } finally {
    process.env.FAKTURAPASS_ENV = "SANDBOX";
  }
  assert.equal(await service.processJob(), true);
  let report = await operationalStatus();
  assert.equal(
    report.jobs.find((j: any) => j.outcome === "REJECTED").attempts,
    1,
  );
  assert.equal(report.queue.pending, 0);
  assert.equal(await service.processJob(), false);
  report = await operationalStatus();
  assert.equal(
    report.jobs.find((j: any) => j.outcome === "REJECTED").attempts,
    1,
  );
  // A completed validation paired with a reclaimed job is recovered without duplicating business results.
  await pool.query(
    "UPDATE jobs SET state='RUNNING',lease_until=now()-interval '1 second' WHERE environment='SANDBOX'",
  );
  assert.equal(await service.processJob(), true);
  report = await operationalStatus();
  assert.equal(
    report.jobs.find((j: any) => j.outcome === "RECOVERED").attempts,
    1,
  );
  assert.equal(report.status, "healthy");
  assert.equal((await snapshotRequest(secret)).status, 200);
});
test("Technical retry metrics are durable and distinct from invoice validation failures", async () => {
  const invoice = JSON.parse(
    readFileSync("fixtures/valid/FP-A-001.json", "utf8"),
  );
  invoice.source.recordId = randomUUID();
  const created = await service.ingest(
    ctx,
    invoice,
    Buffer.from(JSON.stringify(invoice)),
    randomUUID(),
  );
  await service.enqueueValidation(
    ctx,
    created.invoiceId,
    created.revisionId,
    null,
  );
  const engine = process.env.INVOICE_ENGINE_URL;
  process.env.INVOICE_ENGINE_URL = "http://127.0.0.1:1";
  try {
    assert.equal(await service.processJob(), true);
  } finally {
    process.env.INVOICE_ENGINE_URL = engine;
  }
  await pool.query(
    "UPDATE jobs SET created_at=now()-interval '10 minutes',available_at=now()+interval '5 seconds' WHERE environment='SANDBOX' AND state='PENDING'",
  );
  const report = await operationalStatus();
  assert(report.alerts.includes("JOB_RETRY_DELAYED"));
  assert.equal(report.queue.retrying, 1);
  assert.equal(report.jobs.find((j: any) => j.outcome === "RETRY").attempts, 1);
  assert.equal(
    report.jobs.find((j: any) => j.outcome === "REJECTED").attempts,
    1,
  );
  await pool.query(
    "UPDATE jobs SET state='DONE',last_error_code=NULL WHERE environment='SANDBOX'",
  );
  await pool.query("DELETE FROM worker_heartbeats WHERE environment='SANDBOX'");
});

test("A real worker publishes its environment heartbeat and removes it on graceful shutdown", async () => {
  const worker = spawn(
    process.execPath,
    ["--import", "tsx", "apps/worker/index.ts"],
    { env: { ...process.env, FAKTURAPASS_ENV: "PILOT" }, stdio: "ignore" },
  );
  const exited = new Promise<void>((resolve, reject) => {
    worker.once("error", reject);
    worker.once("exit", () => resolve());
  });
  try {
    let active = false;
    for (let n = 0; n < 80; n++) {
      if (
        (
          await pool.query(
            "SELECT 1 FROM worker_heartbeats WHERE environment='PILOT'",
          )
        ).rowCount
      ) {
        active = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(active, "worker heartbeat appeared");
    process.env.FAKTURAPASS_ENV = "PILOT";
    assert.equal((await operationalStatus()).workers.active, 1);
  } finally {
    process.env.FAKTURAPASS_ENV = "SANDBOX";
    worker.kill("SIGTERM");
    await exited;
  }
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int n FROM worker_heartbeats WHERE environment='PILOT'",
      )
    ).rows[0].n,
    0,
  );
});
test("A blocked database probe times out and reports unavailable data rather than zero counts", async () => {
  const blocker = await pool.connect();
  await blocker.query("BEGIN");
  await blocker.query("LOCK TABLE jobs IN ACCESS EXCLUSIVE MODE");
  try {
    const started = Date.now();
    const report = await operationalStatus();
    assert(Date.now() - started < 5000);
    assert.equal(report.components.database, "down");
    assert(report.alerts.includes("DATABASE_UNAVAILABLE"));
    assert.equal(report.queue, null);
    assert.equal(report.workers, null);
    assert.equal(report.jobs, null);
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
  }
});

test("An idle application connection failure is sanitized and the pool reconnects", async () => {
  const client = await pool.connect();
  const pid = (await client.query("SELECT pg_backend_pid() AS pid")).rows[0]
    .pid;
  const logs: string[] = [];
  const original = console.error;
  console.error = (value: unknown) => {
    logs.push(String(value));
  };
  let onError: () => void = () => {};
  const failed = new Promise<void>((resolve) => {
    onError = resolve;
    pool.once("error", onError);
  });
  client.release();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await operationsPool.query("SELECT pg_terminate_backend($1)", [pid]);
    await Promise.race([
      failed,
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(Error("Missing idle connection error")),
          5000,
        );
      }),
    ]);
    assert.deepEqual(logs, [
      JSON.stringify({ service: "database", code: "DATABASE_UNAVAILABLE" }),
    ]);
    assert.equal((await pool.query("SELECT 1 AS ok")).rows[0].ok, 1);
  } finally {
    clearTimeout(timeout);
    pool.off("error", onError);
    console.error = original;
  }
});
