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

test("tenant recipient versions bind validation, evidence and approvals and reject stale coverage", async () => {
  const recipients = await import("../packages/recipients/service");
  const canonical = structuredClone(basic);
  canonical.source.recordId = randomUUID();
  canonical.document.purchaseOrderReference = "PO-VERIFIED";
  const profile = {
    ...JSON.parse(readFileSync("examples/recipient-profile.json", "utf8")),
    recipientKey: `recipient-${randomUUID()}`,
    status: "TENANT_VERIFIED",
    identifiers: [canonical.buyer.electronicAddress],
    evidence: [
      {
        sourceType: "TEST",
        title: "Synthetic acceptance fixture",
        urlOrReference: "fixture:recipient-requirements",
        retrievedAt: "2026-01-01T00:00:00Z",
        reviewedAt: "2026-01-02T00:00:00Z",
        effectiveFrom: null,
      },
    ],
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };
  await assert.rejects(
    recipients.publish(
      { ...ctx, role: "OPERATOR" },
      { profile, priorVersionId: null },
    ),
    { code: "ACCESS_DENIED" },
  );
  const v1 = (await recipients.publish(ctx, {
    profile,
    priorVersionId: null,
  }))!;
  await assert.rejects(recipients.resolve(other, v1.versionId), {
    code: "RECIPIENT_PROFILE_UNKNOWN",
  });
  assert(
    !(await recipients.list(other)).some((p) => p.versionId === v1.versionId),
  );
  const otherVersion = (await recipients.publish(other, {
    profile,
    priorVersionId: null,
  }))!;
  assert.notEqual(otherVersion.versionId, v1.versionId);
  const created = await s.ingest(
    ctx,
    canonical,
    Buffer.from(JSON.stringify(canonical)),
    randomUUID(),
  );
  const run = await s.enqueueValidation(
    ctx,
    created.invoiceId,
    created.revisionId,
    v1.versionId,
  );
  const completed = await finish(run.validationRunId);
  assert.equal(completed.status, "PASS");
  assert.equal(completed.recipientSnapshot.requirementsResult, "PASS");
  await s.approve(
    ctx,
    created.invoiceId,
    created.revisionId,
    run.validationRunId,
    v1.versionId,
  );
  const savedEvidence = await s.evidence(ctx, created.invoiceId);
  assert.equal(savedEvidence.recipientProfile.profile.sha256, v1.sha256);
  const outputInvoice = structuredClone(canonical);
  outputInvoice.source.recordId = randomUUID();
  const output = await create(outputInvoice);
  const outputRun = await s.enqueueValidation(
    ctx,
    output.invoiceId,
    output.revisionId,
    v1.versionId,
  );
  assert.equal((await finish(outputRun.validationRunId)).status, "PASS");
  await s.approve(
    ctx,
    output.invoiceId,
    output.revisionId,
    outputRun.validationRunId,
    v1.versionId,
  );
  const generated = await s.enqueueGeneration(
    ctx,
    output.invoiceId,
    output.revisionId,
  );
  assert.equal((await finish(generated.validationRunId)).status, "PASS");
  assert.equal(
    (await s.evidence(ctx, output.invoiceId)).recipientProfile.profile.sha256,
    v1.sha256,
  );
  const originalNow = Date.now;
  try {
    Date.now = () => originalNow() + 172800000;
    await assert.rejects(
      s.enqueueGeneration(ctx, created.invoiceId, created.revisionId),
      { code: "APPROVAL_STALE" },
    );
  } finally {
    Date.now = originalNow;
  }
  const v2 = (await recipients.publish(ctx, {
    profile: {
      ...profile,
      requirements: [
        ...profile.requirements,
        {
          id: "contract",
          fieldPath: "document.contractReference",
          predicate: "PRESENT",
          severity: "ERROR",
          messageKey: "RECIPIENT_REQUIREMENT_MISSING",
        },
      ],
    },
    priorVersionId: v1.versionId,
  }))!;
  await assert.rejects(
    s.enqueueGeneration(ctx, created.invoiceId, created.revisionId),
    { code: "APPROVAL_STALE" },
  );
  await assert.rejects(
    s.approve(
      ctx,
      created.invoiceId,
      created.revisionId,
      run.validationRunId,
      v1.versionId,
    ),
    { code: "APPROVAL_STALE" },
  );
  await assert.rejects(
    recipients.publish(ctx, { profile, priorVersionId: v1.versionId }),
    { code: "REVISION_CONFLICT" },
  );
  assert.equal((await recipients.history(ctx, profile.recipientKey)).length, 2);
  assert.deepEqual(await s.evidence(ctx, created.invoiceId), savedEvidence);
  await assert.rejects(
    pool.query(
      "UPDATE recipient_profile_versions SET rules_json='{}' WHERE id=$1",
      [v1.versionId],
    ),
  );
  const check2 = await s.enqueueValidation(
    ctx,
    created.invoiceId,
    created.revisionId,
    v2.versionId,
  );
  const failed = await finish(check2.validationRunId);
  assert.equal(failed.status, "FAIL");
  assert(
    failed.findings.some(
      (f: any) =>
        f.canonicalPath === "document.contractReference" &&
        f.evidenceSource === "fixture:recipient-requirements",
    ),
  );
});

test("review ownership is tenant scoped, concurrent-safe and persists across corrections", async () => {
  const review = await import("../packages/review/service");
  const i = input();
  const c = await create(i);
  const one = { ...ctx, actor: "review-one", role: "OPERATOR" as const },
    two = { ...ctx, actor: "review-two", role: "OPERATOR" as const };
  const request = {
    action: "CLAIM" as const,
    expectedRevisionId: c.revisionId,
    expectedVersion: 0,
  };
  await assert.rejects(review.assign(other, c.invoiceId, request), {
    code: "RESOURCE_NOT_FOUND",
  });
  await assert.rejects(
    review.assign({ ...one, role: "READ_ONLY" }, c.invoiceId, request),
    { code: "ACCESS_DENIED" },
  );
  const outcomes = await Promise.allSettled([
    review.assign(one, c.invoiceId, request),
    review.assign(two, c.invoiceId, request),
  ]);
  assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 1);
  const winner = outcomes[0].status === "fulfilled" ? one : two,
    loser = winner === one ? two : one;
  const assigned = (await review.list(winner, { owner: "mine" })).items.find(
    (x) => x.invoiceId === c.invoiceId,
  )!;
  assert(assigned.assignment.isMine);
  assert.equal(assigned.assignment.version, 1);
  assert(assigned.reasons.includes("VALIDATION_REQUIRED"));
  await assert.rejects(
    review.assign(loser, c.invoiceId, {
      ...request,
      action: "RELEASE",
      expectedVersion: 1,
    }),
    { code: "ACCESS_DENIED" },
  );
  const fixed = structuredClone(i);
  fixed.document.number += "-revision";
  const newer = await s.correct(
    ctx,
    c.invoiceId,
    c.revisionId,
    fixed,
    Buffer.from(JSON.stringify(fixed)),
  );
  await assert.rejects(
    review.assign(winner, c.invoiceId, {
      ...request,
      action: "RELEASE",
      expectedVersion: 1,
    }),
    { code: "REVISION_CONFLICT" },
  );
  const queue = await review.list(winner, { owner: "mine" });
  assert.equal(
    queue.items.find((x) => x.invoiceId === c.invoiceId)?.revisionId,
    newer.revisionId,
  );
  const released = await review.assign(winner, c.invoiceId, {
    action: "RELEASE",
    expectedRevisionId: newer.revisionId,
    expectedVersion: 1,
  });
  assert.equal(released.owner, null);
  assert.equal(released.version, 2);
  assert(
    !(await review.list(other)).items.some((x) => x.invoiceId === c.invoiceId),
  );
  const audit = (
    await pool.query(
      "SELECT action FROM audit_events WHERE tenant_id=$1 AND resource_id=$2 AND action LIKE 'REVIEW_%'",
      [ctx.tenantId, c.invoiceId],
    )
  ).rows;
  assert.deepEqual(audit.map((x) => x.action).sort(), [
    "REVIEW_CLAIM",
    "REVIEW_RELEASE",
  ]);
  const first = await review.list(ctx, { limit: 1 });
  assert.equal(first.items.length, 1);
  assert(first.nextCursor);
  await assert.rejects(
    review.list(other, { limit: 1, cursor: first.nextCursor }),
    { code: "INVALID_REQUEST" },
  );
});

test("membership changes serialize last-admin protection and reject stale or cross-tenant changes", async () => {
  const { updateMember, resolveMembership } =
    await import("../packages/identity/memberships");
  const tenant = `team-${randomUUID()}`;
  await pool.query("INSERT INTO tenants(id,name) VALUES($1,'Team test')", [
    tenant,
  ]);
  const ids = [randomUUID(), randomUUID()];
  for (let n = 0; n < 2; n++)
    await pool.query(
      "INSERT INTO memberships(id,tenant_id,user_subject,role,status) VALUES($1,$2,$3,'ADMIN','ACTIVE')",
      [ids[n], tenant, `member-${n}`],
    );
  const contexts = [0, 1].map((n) => ({
    tenantId: tenant,
    actor: `member-${n}`,
    role: "ADMIN" as const,
    environment: "LOCAL",
    requestId: randomUUID(),
  }));
  const results = await Promise.allSettled(
    contexts.map((ctx, n) =>
      updateMember(ctx, ids[n], {
        role: "OPERATOR",
        status: "ACTIVE",
        expectedVersion: 1,
      }),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const rejected = results.find(
    (r) => r.status === "rejected",
  ) as PromiseRejectedResult;
  assert.equal(rejected.reason.code, "LAST_ADMIN_REQUIRED");
  const admin = results.findIndex((r) => r.status === "rejected");
  const operator = 1 - admin;
  assert.equal(
    await resolveMembership(tenant, contexts[operator].actor),
    "OPERATOR",
  );
  await assert.rejects(
    updateMember(contexts[operator], ids[admin], {
      role: "READ_ONLY",
      status: "ACTIVE",
      expectedVersion: 1,
    }),
    { code: "ACCESS_DENIED" },
  );
  await assert.rejects(
    updateMember(contexts[admin], ids[operator], {
      role: "READ_ONLY",
      status: "ACTIVE",
      expectedVersion: 1,
    }),
    { code: "REVISION_CONFLICT" },
  );
  await assert.rejects(
    updateMember(contexts[admin], "local-owner", {
      role: "READ_ONLY",
      status: "ACTIVE",
      expectedVersion: 1,
    }),
    { code: "RESOURCE_NOT_FOUND" },
  );
  await updateMember(contexts[admin], ids[operator], {
    role: "OPERATOR",
    status: "SUSPENDED",
    expectedVersion: 2,
  });
  await assert.rejects(resolveMembership(tenant, contexts[operator].actor), {
    code: "ACCESS_DENIED",
  });
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM audit_events WHERE tenant_id=$1 AND action='MEMBERSHIP_UPDATE'",
        [tenant],
      )
    ).rows[0].n,
    2,
  );
});
