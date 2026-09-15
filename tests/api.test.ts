import { test, after, before } from "node:test";
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
before(async () => {
  for (const [tenant, actor, role] of [
    ["local-demo", "a", "ADMIN"],
    ["local-test-b", "b", "ADMIN"],
    ["local-demo", "r", "READ_ONLY"],
  ])
    await pool.query(
      "INSERT INTO memberships(id,tenant_id,user_subject,role,status) VALUES($1,$2,$3,$4,'ACTIVE') ON CONFLICT(tenant_id,user_subject) DO NOTHING",
      [randomUUID(), tenant, actor, role],
    );
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

test("CSV endpoints enforce contracts, preview binding and tenant boundaries", async () => {
  const csv = readFileSync("examples/customer-invoices.csv", "utf8").replaceAll(
    "CSV-EXAMPLE",
    randomUUID(),
  );
  const recipe = JSON.parse(readFileSync("examples/csv-recipe.json", "utf8"));
  const input = { csv, recipeId: recipe.id, recipeVersion: recipe.version };
  assert.equal((await call("mapping-recipes")).status, 200);
  assert.deepEqual(
    (await (await call("mapping-recipes", undefined, "test-b")).json()).items,
    [],
  );
  assert.equal((await call("csv/preview", input, "test-b")).status, 404);
  const preview = await call("csv/preview", input);
  assert.equal(preview.status, 200);
  const result = await preview.json();
  const commit = {
    ...input,
    sourceSha256: result.sourceSha256,
    recipeSha256: result.recipeSha256,
  };
  const headers = { "Idempotency-Key": randomUUID() };
  assert.equal(
    (await call("csv/import", commit, "test-reader", headers)).status,
    403,
  );
  assert.equal(
    (
      await call("csv/import", commit, "", {
        ...headers,
        Origin: "http://evil.invalid",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "csv/import",
        { ...commit, sourceSha256: "0".repeat(64) },
        "test-a",
        headers,
      )
    ).status,
    409,
  );
  const saved = await call("csv/import", commit, "test-a", headers);
  assert.equal(saved.status, 200);
  assert.deepEqual(
    await saved.json(),
    await (await call("csv/import", commit, "test-a", headers)).json(),
  );
});

test("recipient API versions enforce roles, optimistic concurrency and tenant isolation", async () => {
  const profile = {
    ...JSON.parse(readFileSync("examples/recipient-profile.json", "utf8")),
    recipientKey: `api-${randomUUID()}`,
  };
  const input = { profile, priorVersionId: null };
  assert.equal((await call("recipient-profiles")).status, 200);
  assert.equal(
    (await call("recipient-profiles", input, "test-reader")).status,
    403,
  );
  assert.equal(
    (
      await call("recipient-profiles", input, "", {
        Origin: "http://evil.invalid",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("recipient-profiles", {
        ...input,
        profile: { ...profile, status: "VERIFIED" },
      })
    ).status,
    400,
  );
  const first = await call("recipient-profiles", input);
  assert.equal(first.status, 201);
  const v1 = await first.json();
  assert.equal(
    (await call(`recipient-profiles/${profile.recipientKey}`)).status,
    200,
  );
  assert.equal(
    (
      await call(
        `recipient-profiles/${profile.recipientKey}`,
        undefined,
        "test-b",
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await call(
        `recipient-profiles/${profile.recipientKey}/versions`,
        undefined,
        "test-b",
      )
    ).status,
    404,
  );
  assert.equal((await call("recipient-profiles", input)).status, 409);
  const second = await call("recipient-profiles", {
    profile: { ...profile, displayName: "New source review" },
    priorVersionId: v1.versionId,
  });
  assert.equal(second.status, 201);
  const history = await (
    await call(`recipient-profiles/${profile.recipientKey}/versions`)
  ).json();
  assert.equal(history.items.length, 2);
  assert.equal(history.items[1].sha256, v1.sha256);
});

test("review queue contracts reject forged ownership and preserve scoped assignments", async () => {
  const i = structuredClone(base);
  i.source.recordId = randomUUID();
  const c = await (
    await call("invoices", i, "test-a", { "Idempotency-Key": randomUUID() })
  ).json();
  assert.equal((await call("review-queue?owner=mine&limit=10")).status, 200);
  assert.equal((await call("review-queue?owner=other")).status, 400);
  assert.equal((await call("review-queue?limit=101")).status, 400);
  const path = `review-queue/${c.invoiceId}/assignment`,
    body = {
      action: "CLAIM",
      expectedRevisionId: c.revisionId,
      expectedVersion: 0,
    };
  assert.equal((await call(path, body, "test-b")).status, 404);
  assert.equal((await call(path, body, "test-reader")).status, 403);
  assert.equal((await call(path, { ...body, owner: "forged" })).status, 400);
  assert.equal(
    (await call(path, body, "", { Origin: "http://evil.invalid" })).status,
    403,
  );
  const assigned = await call(path, body);
  assert.equal(assigned.status, 200);
  assert.equal((await assigned.json()).owner, "a");
  assert.equal((await call(path, body)).status, 409);
  assert.equal(
    (await call(path, { ...body, action: "RELEASE", expectedVersion: 1 }))
      .status,
    200,
  );
});

test("database memberships override token roles and suspension takes effect on the next request", async () => {
  const configured = process.env.LOCAL_API_IDENTITIES!;
  const identities = JSON.parse(configured);
  identities["test-reader"].role = "ADMIN";
  process.env.LOCAL_API_IDENTITIES = JSON.stringify(identities);
  let member = (await (await call("memberships")).json()).items.find(
    (m: any) => m.subject === "r",
  );
  try {
    assert.equal(
      (await call("memberships", undefined, "test-reader")).status,
      403,
    );
    assert.equal(
      (
        await call(
          `memberships/${member.id}`,
          { role: "ADMIN", status: "ACTIVE", expectedVersion: member.version },
          "test-reader",
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          `memberships/${member.id}`,
          {
            role: "OPERATOR",
            status: "ACTIVE",
            expectedVersion: member.version,
          },
          "test-b",
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await call(`memberships/${member.id}`, {
          role: "OPERATOR",
          status: "ACTIVE",
          expectedVersion: member.version,
          tenantId: "local-test-b",
        })
      ).status,
      400,
    );
    member = await (
      await call(`memberships/${member.id}`, {
        role: "OPERATOR",
        status: "ACTIVE",
        expectedVersion: member.version,
      })
    ).json();
    const invoice = structuredClone(base);
    invoice.source.recordId = randomUUID();
    assert.equal(
      (
        await call("invoices", invoice, "test-reader", {
          "Idempotency-Key": randomUUID(),
        })
      ).status,
      201,
    );
    member = await (
      await call(`memberships/${member.id}`, {
        role: "OPERATOR",
        status: "SUSPENDED",
        expectedVersion: member.version,
      })
    ).json();
    assert.equal(
      (await call("invoices", undefined, "test-reader")).status,
      403,
    );
    assert.equal(
      (
        await call(`memberships/${member.id}`, {
          role: "READ_ONLY",
          status: "ACTIVE",
          expectedVersion: 1,
        })
      ).status,
      409,
    );
  } finally {
    await call(`memberships/${member.id}`, {
      role: "READ_ONLY",
      status: "ACTIVE",
      expectedVersion: member.version,
    });
    process.env.LOCAL_API_IDENTITIES = configured;
  }
  assert.equal((await call("invoices", undefined, "test-reader")).status, 200);
});
