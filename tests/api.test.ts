import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { GET, POST } from "../apps/web/app/api/v1/[...path]/route";
import { pool } from "../packages/database";
import { processJob } from "../packages/domain/service";
import { sha256 } from "../packages/domain";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import YAML from "yaml";
const spec = YAML.parse(
  readFileSync("packages/contracts/openapi.yaml", "utf8"),
);
const definitions = JSON.parse(
  JSON.stringify(spec.components.schemas).replaceAll(
    "#/components/schemas/",
    "#/$defs/",
  ),
);
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const responseChecks = new Map<string, ReturnType<typeof ajv.compile>>();
const base = JSON.parse(readFileSync("fixtures/valid/FP-A-001.json", "utf8"));
process.env.FAKTURAPASS_ENV = "LOCAL";
process.env.LOCAL_BROWSER_IDENTITY = "enabled";
process.env.LOCAL_API_IDENTITIES = JSON.stringify({
  "test-a": { tenantId: "local-demo", actor: "a", role: "ADMIN" },
  "test-b": { tenantId: "local-test-b", actor: "b", role: "ADMIN" },
  "test-reader": { tenantId: "local-demo", actor: "r", role: "READ_ONLY" },
});
async function call(
  path: string,
  body?: unknown,
  token = "test-a",
  headers: Record<string, string> = {},
) {
  const req = new Request(`http://localhost:3010/api/v1/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Host: "127.0.0.1:3010",
      "Content-Type": "application/json",
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : { Origin: "http://127.0.0.1:3010" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const response = await (body === undefined ? GET : POST)(req, {
    params: Promise.resolve({ path: path.split("?")[0].split("/") }),
  });
  const cleanPath = "/" + path.split("?")[0];
  const template = Object.keys(spec.paths).find((p) =>
    new RegExp("^" + p.replace(/\{[^}]+\}/g, "[^/]+") + "$").test(cleanPath),
  );
  assert(template, `Undocumented route: ${cleanPath}`);
  const operation = spec.paths[template][body === undefined ? "get" : "post"];
  const responseSchema =
    operation.responses[response.status]?.content?.["application/json"]?.schema;
  assert(
    operation.responses[response.status],
    `Undocumented response: ${response.status}`,
  );
  if (responseSchema) {
    const key = `${operation.operationId}:${response.status}`;
    if (!responseChecks.has(key))
      responseChecks.set(
        key,
        ajv.compile({
          $defs: definitions,
          ...JSON.parse(
            JSON.stringify(responseSchema).replaceAll(
              "#/components/schemas/",
              "#/$defs/",
            ),
          ),
        }),
      );
    const check = responseChecks.get(key)!;
    assert(check(await response.clone().json()), JSON.stringify(check.errors));
  }
  return response;
}
async function finish(id: string) {
  for (let n = 0; n < 100; n++) {
    const r = await (await call(`validation-runs/${id}`)).json();
    if (["PASS", "FAIL"].includes(r.status)) return r;
    await processJob();
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("timeout");
}
after(() => pool.end());
test("all invoice endpoints enforce auth, correlations, bodies and response contracts", async () => {
  const i = structuredClone(base);
  i.source.recordId = randomUUID();
  const key = randomUUID();
  let response = await call("invoices", i, "test-a", {
    "Idempotency-Key": key,
    "X-Request-Id": "api-contract-test",
  });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("x-request-id"), "api-contract-test");
  const c = await response.json();
  assert.equal(
    (await call("invoices", i, "test-a", { "Idempotency-Key": key })).status,
    201,
  );
  assert.equal(
    (
      await call("invoices", { ...i, extensions: { x: true } }, "test-a", {
        "Idempotency-Key": key,
      })
    ).status,
    409,
  );
  assert.equal(
    (await call("invoices", i, "test-reader", { "Idempotency-Key": key }))
      .status,
    403,
  );
  assert.equal((await call("invoices?limit=101")).status, 400);
  assert.equal((await call("invoices", {}, "bad")).status, 401);
  assert.equal(
    (await call("invoices", {}, "", { Origin: "http://evil.invalid" })).status,
    403,
  );
  assert.equal((await call("invoices", {}, "")).status, 400);
  assert.equal((await call("invoices?cursor=invalid")).status, 400);
  const prefix = `invoices/${c.invoiceId}/revisions/${c.revisionId}`;
  for (const action of ["validate", "approve", "generate"]) {
    assert.equal((await call(`${prefix}/${action}`, null)).status, 400);
    assert.equal(
      (await call(`${prefix}/${action}`, { tenantId: "forged" })).status,
      400,
    );
  }
  response = await call(`${prefix}/validate`, {});
  assert.equal(response.status, 202);
  const v = await response.json();
  assert.equal((await finish(v.validationRunId)).status, "PASS");
  assert.equal(
    (
      await call(`${prefix}/approve`, {
        validationRunId: v.validationRunId,
        recipientProfileVersionId: null,
      })
    ).status,
    201,
  );
  response = await call(`${prefix}/generate`, {});
  assert.equal(response.status, 202);
  assert.equal(
    (await finish((await response.json()).validationRunId)).status,
    "PASS",
  );
  const revision = await (await call(prefix)).json();
  assert.equal(revision.status, "ARTIFACT_VALIDATED");
  const a = revision.artifacts[0];
  assert.equal((await call(`artifacts/${a.artifactId}`)).status, 200);
  const download = await call(`artifacts/${a.artifactId}/download`);
  assert.equal(download.status, 200);
  assert.equal(sha256(Buffer.from(await download.arrayBuffer())), a.sha256);
  assert.equal(
    (await (await call(`invoices/${c.invoiceId}/evidence`)).json()).generation
      .sha256,
    a.sha256,
  );
  const englishDownload = await call(
    `artifacts/${a.artifactId}/download`,
    undefined,
    "test-a",
    { "Accept-Language": "en" },
  );
  assert.equal(
    sha256(Buffer.from(await englishDownload.arrayBuffer())),
    a.sha256,
  );
  const evidenceDe = await call(
    `invoices/${c.invoiceId}/evidence`,
    undefined,
    "test-a",
    { "Accept-Language": "de" },
  );
  const evidenceEn = await call(
    `invoices/${c.invoiceId}/evidence`,
    undefined,
    "test-a",
    { "Accept-Language": "en" },
  );
  assert.deepEqual(await evidenceDe.json(), await evidenceEn.json());
  for (const path of [
    `invoices/${c.invoiceId}`,
    prefix,
    `validation-runs/${v.validationRunId}`,
    `artifacts/${a.artifactId}`,
    `artifacts/${a.artifactId}/download`,
    `invoices/${c.invoiceId}/evidence`,
  ])
    assert.equal((await call(path, undefined, "test-b")).status, 404);
  for (const action of ["validate", "approve", "generate"])
    assert.equal(
      (
        await call(
          `${prefix}/${action}`,
          action === "approve" ? { validationRunId: v.validationRunId } : {},
          "test-reader",
        )
      ).status,
      403,
    );
  assert.equal((await call("recipient-profiles/demo-reference")).status, 200);
  assert.equal((await call("recipient-profiles/unknown")).status, 404);
  assert.equal((await call("health/live", undefined, "bad")).status, 200);
  assert.equal((await call("health/ready")).status, 200);
  const fixed = structuredClone(i);
  fixed.document.buyerReference = "CORRECTED";
  assert.equal(
    (
      await call(`invoices/${c.invoiceId}/revisions`, {
        priorRevisionId: c.revisionId,
        canonical: fixed,
      })
    ).status,
    201,
  );
  assert.equal(
    (await call(`invoices/${c.invoiceId}/evidence?revisionId=${c.revisionId}`))
      .status,
    200,
  );
});
test("oversized payload and production-disabled identity fail safely", async () => {
  const huge = new Request("http://127.0.0.1:3010/api/v1/invoices", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-a",
      "Content-Type": "application/json",
    },
    body: "x".repeat(1024 * 1024 + 1),
  });
  assert.equal(
    (await POST(huge, { params: Promise.resolve({ path: ["invoices"] }) }))
      .status,
    413,
  );
  process.env.FAKTURAPASS_ENV = "PRODUCTION";
  try {
    assert.equal((await call("invoices")).status, 401);
  } finally {
    process.env.FAKTURAPASS_ENV = "LOCAL";
  }
});

test("API errors and profile labels honor Accept-Language without changing codes", async () => {
  const english = await call("invoices", {}, "test-a", {
    "Idempotency-Key": randomUUID(),
    "Accept-Language": "en-GB",
  });
  assert.equal(english.status, 400);
  assert.equal(english.headers.get("Content-Language"), "en");
  const error = (await english.json()).error;
  assert.equal(error.code, "SCHEMA_INVALID");
  assert.equal(
    error.message,
    "The file does not match the invoice format. Please check the highlighted fields.",
  );
  const german = await call("invoices", {}, "test-a", {
    "Idempotency-Key": randomUUID(),
    "Accept-Language": "de",
  });
  assert.equal((await german.json()).error.code, error.code);
  assert.equal(german.headers.get("Content-Language"), "de");
  const profile = await call(
    "recipient-profiles/demo-reference",
    undefined,
    "test-a",
    { "Accept-Language": "en" },
  );
  assert.equal((await profile.json()).displayName, "Buyer reference");
});
