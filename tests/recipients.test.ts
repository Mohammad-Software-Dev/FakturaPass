import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  coverage,
  checkRecipient,
  validateProfile,
  syntheticVersions,
} from "../packages/recipients/model";
const invoice = JSON.parse(
  readFileSync("fixtures/valid/FP-A-001.json", "utf8"),
);
const base = JSON.parse(
  readFileSync("examples/recipient-profile.json", "utf8"),
);
function verified() {
  return {
    ...base,
    status: "TENANT_VERIFIED",
    identifiers: [invoice.buyer.electronicAddress],
    evidence: [
      {
        sourceType: "TEST",
        title: "Synthetic test evidence",
        urlOrReference: "fixture:recipient-v1",
        retrievedAt: "2026-01-01T00:00:00Z",
        reviewedAt: "2026-01-02T00:00:00Z",
        effectiveFrom: null,
      },
    ],
    expiresAt: "2027-01-01T00:00:00Z",
    required: base.requirements.map((r: any) => r.fieldPath),
    versionId: "test",
    version: "1",
    sha256: "test",
    createdBy: "test",
    createdAt: null,
    current: true,
  };
}
const now = Date.parse("2026-09-14T12:00:00Z");
test("recipient coverage separates missing, synthetic, unverified and evidenced requirements", () => {
  assert.equal(coverage(null, invoice, now), "UNKNOWN");
  assert.equal(coverage(syntheticVersions()[0], invoice, now), "SYNTHETIC");
  assert.equal(
    coverage({ ...verified(), status: "UNVERIFIED" }, invoice, now),
    "UNVERIFIED",
  );
  assert.equal(coverage(verified(), invoice, now), "VERIFIED");
  const i = structuredClone(invoice);
  i.document.purchaseOrderReference = "PO-1";
  assert.equal(checkRecipient(verified(), i, now).requirementsResult, "PASS");
  i.document.purchaseOrderReference = null;
  const result = checkRecipient(verified(), i, now);
  assert.equal(result.requirementsResult, "FAIL");
  assert.equal(result.findings[0].evidenceSource, "fixture:recipient-v1");
  assert.equal(
    result.findings[0].canonicalPath,
    "document.purchaseOrderReference",
  );
});
test("expiry, effective dates, supersession, retirement, recipient identity and route fail closed", () => {
  const p = verified();
  assert.equal(coverage(p, invoice, Date.parse(p.expiresAt)), "EXPIRED");
  assert.equal(coverage({ ...p, current: false }, invoice, now), "SUPERSEDED");
  assert.equal(coverage({ ...p, status: "RETIRED" }, invoice, now), "RETIRED");
  assert.equal(
    coverage(
      {
        ...p,
        evidence: [{ ...p.evidence[0], effectiveFrom: "2026-10-01T00:00:00Z" }],
      },
      invoice,
      now,
    ),
    "NOT_YET_EFFECTIVE",
  );
  assert.equal(
    coverage(
      { ...p, identifiers: [{ schemeId: "WRONG", value: "x" }] },
      invoice,
      now,
    ),
    "MISMATCH",
  );
  assert.equal(
    coverage(
      { ...p, accepted: { ...p.accepted, channels: ["EMAIL"] } },
      invoice,
      now,
    ),
    "UNSUPPORTED_ROUTE",
  );
  assert(
    checkRecipient({ ...p, current: false }, invoice, now).findings.some(
      (f) => f.severity === "ERROR",
    ),
  );
});
test("profile publication requires explicit evidence, safe predicates and tenant status", () => {
  validateProfile(base, now);
  validateProfile(verified(), now);
  for (const patch of [
    { status: "VERIFIED" },
    { status: "SYNTHETIC" },
    { recipientKey: "demo-reference" },
    { evidence: [] },
    { expiresAt: null },
    { expiresAt: "2026-01-01T00:00:00Z" },
    { requirements: [{ ...base.requirements[0], predicate: "eval" }] },
    {
      evidence: [
        { ...verified().evidence[0], reviewedAt: "2099-01-01T00:00:00Z" },
      ],
    },
  ])
    assert.throws(() => validateProfile({ ...verified(), ...patch }, now));
});
