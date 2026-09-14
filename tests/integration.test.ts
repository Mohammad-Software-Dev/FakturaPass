import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { pool } from "../packages/database";
import * as s from "../packages/domain/service";
import { generateUbl } from "../packages/domain/ubl";
import { officialValidate } from "../packages/domain/engine";
import { sha256, stable } from "../packages/domain";
const ctx: s.Context = {
  tenantId: "local-demo",
  actor: "integration",
  role: "ADMIN",
  environment: "LOCAL",
  requestId: randomUUID(),
};
const other = { ...ctx, tenantId: "local-test-b" };
const basic = JSON.parse(readFileSync("fixtures/valid/FP-A-001.json", "utf8"));
function input() {
  const i = structuredClone(basic);
  i.source.recordId = `test-${randomUUID()}`;
  return i;
}
async function create(i = input()) {
  return s.ingest(
    ctx,
    i,
    Buffer.from(JSON.stringify(i, null, 2)),
    randomUUID(),
  );
}
async function finish(id: string) {
  for (let n = 0; n < 100; n++) {
    const r = await s.getRun(ctx, id);
    if (["PASS", "FAIL"].includes(r.status)) return r;
    await s.processJob();
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Job timeout");
}
after(() => pool.end());
test("real official golden fixtures, original specification defect and deterministic bytes", async () => {
  for (const name of ["FP-A-001", "FP-A-003"]) {
    const i = JSON.parse(readFileSync(`fixtures/valid/${name}.json`, "utf8"));
    const xml = generateUbl(i);
    const result = await officialValidate(xml);
    assert.equal(result.pass, true, JSON.stringify(result.findings));
    const golden = `fixtures/expected-output/${name}.xml`;
    if (process.env.ACCEPT_GOLDENS === "1") {
      writeFileSync(golden, xml);
      writeFileSync(
        `fixtures/expected-output/${name}.findings.json`,
        JSON.stringify(result.findings, null, 2) + "\n",
      );
      writeFileSync(
        `fixtures/expected-output/${name}.sha256`,
        sha256(xml) + "\n",
      );
    } else assert.equal(xml, readFileSync(golden, "utf8"));
    if (process.env.ACCEPT_GOLDENS !== "1")
      assert.deepEqual(
        result.findings,
        JSON.parse(
          readFileSync(
            `fixtures/expected-output/${name}.findings.json`,
            "utf8",
          ),
        ),
      );
  }
  const bad = JSON.parse(
    readFileSync(
      "fixtures/invalid/FP-A-001-original-missing-phone.json",
      "utf8",
    ),
  );
  const result = await officialValidate(generateUbl(bad));
  assert.equal(result.pass, false);
  assert(result.findings.some((f) => f.ruleId === "BR-DE-6"));
});
test("complete persisted pipeline, idempotency, hashes, immutable source and corrections", async () => {
  const i = input();
  const raw = Buffer.from(JSON.stringify(i, null, 2));
  const key = randomUUID();
  const first = await s.ingest(ctx, i, raw, key);
  assert.deepEqual(await s.ingest(ctx, i, raw, key), first);
  await assert.rejects(
    s.ingest(ctx, { ...i, extensions: { changed: true } }, raw, key),
    { code: "IDEMPOTENCY_CONFLICT" },
  );
  await assert.rejects(create(i), {
    code: "SOURCE_DUPLICATE",
    details: { invoiceId: first.invoiceId },
  });
  const v = await s.enqueueValidation(
    ctx,
    first.invoiceId,
    first.revisionId,
    null,
  );
  assert.equal(
    (await s.enqueueValidation(ctx, first.invoiceId, first.revisionId, null))
      .validationRunId,
    v.validationRunId,
  );
  assert.equal((await finish(v.validationRunId)).status, "PASS");
  await s.approve(
    ctx,
    first.invoiceId,
    first.revisionId,
    v.validationRunId,
    null,
  );
  const g = await s.enqueueGeneration(ctx, first.invoiceId, first.revisionId);
  assert.equal((await finish(g.validationRunId)).status, "PASS");
  const detail = await s.revisionDetail(ctx, first.invoiceId, first.revisionId);
  assert.equal(detail.status, "ARTIFACT_VALIDATED");
  assert.equal(detail.artifacts.length, 1);
  const a = await s.artifact(ctx, detail.artifacts[0].artifactId);
  assert.equal(sha256(a.bytes), a.sha256);
  assert.equal(a.bytes.toString(), generateUbl(i));
  assert.equal(detail.sourceArtifact.sha256, sha256(raw));
  assert.equal(detail.canonicalSha256, sha256(stable(i)));
  const evidence = await s.evidence(ctx, first.invoiceId);
  assert.equal(evidence.validation.status, "PASS");
  assert.equal(evidence.generation.sha256, a.sha256);
  assert.equal(evidence.recipientProfile.status, "UNKNOWN");
  await assert.rejects(
    pool.query("UPDATE generation_artifacts SET sha256=$1 WHERE id=$2", [
      "x",
      a.id,
    ]),
  );
  await assert.rejects(
    pool.query("UPDATE invoice_revisions SET canonical_json='{}' WHERE id=$1", [
      first.revisionId,
    ]),
  );
  const fixed = structuredClone(i);
  fixed.document.buyerReference = "DEMO-NEW";
  const second = await s.correct(
    ctx,
    first.invoiceId,
    first.revisionId,
    fixed,
    Buffer.from(JSON.stringify(fixed)),
  );
  assert.equal(second.revisionNumber, 2);
  assert.equal(
    (await s.revisionDetail(ctx, first.invoiceId, first.revisionId)).status,
    "ARTIFACT_VALIDATED",
  );
  await assert.rejects(
    s.correct(ctx, first.invoiceId, first.revisionId, fixed, raw),
    { code: "REVISION_CONFLICT" },
  );
  await assert.rejects(
    s.approve(ctx, first.invoiceId, first.revisionId, v.validationRunId, null),
    { code: "APPROVAL_STALE" },
  );
  for (const fn of [
    () => s.detail(other, first.invoiceId),
    () => s.revisionDetail(other, first.invoiceId, first.revisionId),
    () => s.artifact(other, a.id),
    () => s.evidence(other, first.invoiceId),
    () => s.getRun(other, v.validationRunId),
    () => s.correct(other, first.invoiceId, first.revisionId, fixed, raw),
    () => s.enqueueValidation(other, first.invoiceId, first.revisionId, null),
    () =>
      s.approve(
        other,
        first.invoiceId,
        first.revisionId,
        v.validationRunId,
        null,
      ),
    () => s.enqueueGeneration(other, first.invoiceId, first.revisionId),
  ])
    await assert.rejects(
      fn(),
      (e: any) => e.status === 404 || e.status === 409,
    );
});
test("invalid totals, recipient requirement and unsupported cases block approvals", async () => {
  for (const id of [101, 102, 103, 105]) {
    const i = JSON.parse(
      readFileSync(`fixtures/invalid/FP-A-${id}.json`, "utf8"),
    );
    i.source.recordId = randomUUID();
    const c = await create(i);
    const v = await s.enqueueValidation(
      ctx,
      c.invoiceId,
      c.revisionId,
      id === 101 ? "synthetic-reference-v1" : null,
    );
    assert.equal((await finish(v.validationRunId)).status, "FAIL");
    await assert.rejects(
      s.approve(
        ctx,
        c.invoiceId,
        c.revisionId,
        v.validationRunId,
        id === 101 ? "synthetic-reference-v1" : null,
      ),
      { code: "APPROVAL_BLOCKED" },
    );
    if (id === 105)
      assert.equal(
        (await s.revisionDetail(ctx, c.invoiceId, c.revisionId)).status,
        "BLOCKED_UNSUPPORTED",
      );
  }
});
test("role authorization applies to every mutation", async () => {
  const read = { ...ctx, role: "READ_ONLY" as const };
  await assert.rejects(s.ingest(read, basic, Buffer.from("{}"), "x"), {
    code: "ACCESS_DENIED",
  });
  await assert.rejects(s.correct(read, "x", "x", basic, Buffer.from("{}")), {
    code: "ACCESS_DENIED",
  });
  await assert.rejects(s.enqueueValidation(read, "x", "x", null), {
    code: "ACCESS_DENIED",
  });
  await assert.rejects(s.approve(read, "x", "x", "x", null), {
    code: "ACCESS_DENIED",
  });
  await assert.rejects(s.enqueueGeneration(read, "x", "x"), {
    code: "ACCESS_DENIED",
  });
});
test("concurrent ingestion creates one revision", async () => {
  const i = input(),
    key = randomUUID(),
    raw = Buffer.from(JSON.stringify(i));
  const results = await Promise.all(
    Array.from({ length: 5 }, () => s.ingest(ctx, i, raw, key)),
  );
  assert.equal(new Set(results.map((r) => r.revisionId)).size, 1);
});

test("official engine failures retain a retryable job and recover without duplicates", async () => {
  const i = input();
  const c = await create(i);
  const v = await s.enqueueValidation(ctx, c.invoiceId, c.revisionId, null);
  const previous = process.env.INVOICE_ENGINE_URL;
  process.env.INVOICE_ENGINE_URL = "http://127.0.0.1:1";
  try {
    await s.processJob();
  } finally {
    if (previous) process.env.INVOICE_ENGINE_URL = previous;
    else delete process.env.INVOICE_ENGINE_URL;
  }
  const run = await s.getRun(ctx, v.validationRunId);
  // An independently running local worker may win this lease; full verification runs in an isolated database.
  if (run.status === "ERROR") {
    assert(run.findings.some((f: any) => f.code === "ENGINE_UNAVAILABLE"));
    await pool.query(
      "UPDATE jobs SET available_at=now() WHERE tenant_id=$1 AND payload_json->>'validationRunId'=$2",
      [ctx.tenantId, v.validationRunId],
    );
  }
  assert.equal((await finish(v.validationRunId)).status, "PASS");
  assert.equal(
    (
      await pool.query(
        "SELECT count(*) FROM validation_runs WHERE tenant_id=$1 AND id=$2",
        [ctx.tenantId, v.validationRunId],
      )
    ).rows[0].count,
    "1",
  );
});

test("expired worker lease is reclaimed and completed results cannot be mutated", async () => {
  const c = await create();
  const v = await s.enqueueValidation(ctx, c.invoiceId, c.revisionId, null);
  await pool.query(
    "UPDATE jobs SET state='RUNNING',lease_until=now()-interval '1 second' WHERE tenant_id=$1 AND payload_json->>'validationRunId'=$2 AND state='PENDING'",
    [ctx.tenantId, v.validationRunId],
  );
  assert.equal((await finish(v.validationRunId)).status, "PASS");
  await assert.rejects(
    pool.query(
      "UPDATE validation_runs SET findings='[]' WHERE tenant_id=$1 AND id=$2",
      [ctx.tenantId, v.validationRunId],
    ),
  );
});

test("CSV preview is read-only, batch commit is idempotent and evidence retains CSV provenance", async () => {
  const csvService = await import("../packages/mappings/service");
  const text =
    "\uFEFF" +
    readFileSync("examples/customer-invoices.csv", "utf8").replaceAll(
      "CSV-EXAMPLE",
      `CSV-${randomUUID()}`,
    );
  const recipe = {
    csv: text,
    recipeId: "structured-export",
    recipeVersion: "1",
  };
  assert.equal((await csvService.recipes(other)).length, 0);
  await assert.rejects(csvService.preview(other, recipe), {
    code: "RESOURCE_NOT_FOUND",
  });
  const preview = await csvService.preview(ctx, recipe);
  assert(preview.items.every((i) => i.valid));
  const body = {
    ...recipe,
    sourceSha256: preview.sourceSha256,
    recipeSha256: preview.recipeSha256,
  };
  const key = randomUUID();
  await assert.rejects(
    csvService.commit({ ...ctx, role: "READ_ONLY" }, body, key),
    { code: "ACCESS_DENIED" },
  );
  await assert.rejects(
    csvService.commit(ctx, { ...body, sourceSha256: "wrong" }, key),
    { code: "REVISION_CONFLICT" },
  );
  const result = await csvService.commit(ctx, body, key);
  assert.equal(result.items.length, 2);
  assert.deepEqual(await csvService.commit(ctx, body, key), result);
  const duplicate = await csvService.commit(ctx, body, randomUUID());
  assert(duplicate.items.every((item: any) => item.status === "EXISTS"));
  assert.deepEqual(
    duplicate.items.map((item: any) => item.invoiceId),
    result.items.map((item: any) => item.invoiceId),
  );
  await assert.rejects(
    pool.query(
      "UPDATE csv_recipe_versions SET recipe='{}' WHERE tenant_id=$1 AND id=$2",
      [ctx.tenantId, recipe.recipeId],
    ),
  );
  const invalid = { ...recipe, csv: text.replace("12.5", "12,5") };
  const bad = await csvService.preview(ctx, invalid);
  await assert.rejects(
    csvService.commit(
      ctx,
      {
        ...invalid,
        sourceSha256: bad.sourceSha256,
        recipeSha256: bad.recipeSha256,
      },
      randomUUID(),
    ),
    { code: "MAPPING_INVALID" },
  );
  const changed = { ...recipe, csv: text.replaceAll("CSV-2026", "CHANGED") };
  const c = await csvService.preview(ctx, changed);
  await assert.rejects(
    csvService.commit(
      ctx,
      {
        ...changed,
        sourceSha256: c.sourceSha256,
        recipeSha256: c.recipeSha256,
      },
      key,
    ),
    { code: "IDEMPOTENCY_CONFLICT" },
  );
  const detail = await s.detail(ctx, result.items[0].invoiceId);
  const revision = detail.currentRevision;
  const source = (
    await pool.query(
      "SELECT bytes,media_type,mapping_json FROM source_artifacts WHERE tenant_id=$1 AND id=(SELECT source_artifact_id FROM invoice_revisions WHERE id=$2)",
      [ctx.tenantId, revision.revisionId],
    )
  ).rows[0];
  assert.equal(source.bytes.toString(), text);
  assert.equal(source.media_type, "text/csv");
  assert.equal(source.mapping_json.recipeVersion, "1");
  const run = await s.enqueueValidation(
    ctx,
    result.items[0].invoiceId,
    revision.revisionId,
    null,
  );
  assert.equal((await finish(run.validationRunId)).status, "PASS");
  const evidence = await s.evidence(ctx, result.items[0].invoiceId);
  assert.equal(evidence.source.sha256, sha256(text));
  assert.equal(evidence.source.mapping.provenance["lines.0.quantity"].row, 2);
});
