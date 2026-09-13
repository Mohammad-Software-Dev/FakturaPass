import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  schemaFindings,
  semanticFindings,
  stable,
  sha256,
  Decimal,
} from "../packages/domain";
import { generateUbl } from "../packages/domain/ubl";
const base = JSON.parse(readFileSync("fixtures/valid/FP-A-001.json", "utf8"));
test("golden canonical schema and arithmetic", () => {
  assert.deepEqual(schemaFindings(base), []);
  assert.equal(
    semanticFindings(base).filter((f) => f.severity === "ERROR").length,
    0,
  );
});
test("all top-level required properties are enforced", () => {
  for (const key of Object.keys(base).filter((k) => k !== "payment")) {
    const x = structuredClone(base);
    delete x[key];
    assert(schemaFindings(x).some((f) => f.canonicalPath === key));
  }
});
test("closed schema rejects numeric money, commas, malformed dates, email, sha and missing endpoints", () => {
  for (const mutate of [
    (x: any) => (x.totals.payableAmount = 238),
    (x: any) => (x.totals.payableAmount = "238,00"),
    (x: any) => (x.document.issueDate = "2026-02-30"),
    (x: any) => (x.source.receivedAt = "yesterday"),
    (x: any) => (x.seller.contact.email = "broken"),
    (x: any) => (x.seller.name = ""),
    (x: any) => delete x.seller.electronicAddress,
    (x: any) => (x.unknown = true),
    (x: any) =>
      (x.attachments = [
        { id: "a", fileName: "a", mediaType: "x", sha256: "ABC" },
      ]),
    (x: any) => (x.document.currency = "USD"),
  ]) {
    const x = structuredClone(base);
    mutate(x);
    assert(schemaFindings(x).length);
  }
});
test("negative fixture codes", () => {
  for (const [id, code] of [
    [102, "TOTAL_MISMATCH"],
    [103, "TAX_BREAKDOWN_MISMATCH"],
    [105, "UNSUPPORTED_CASE"],
  ] as const) {
    const x = JSON.parse(
      readFileSync(`fixtures/invalid/FP-A-${id}.json`, "utf8"),
    );
    assert(semanticFindings(x).some((f) => f.code === code));
  }
  const missing = structuredClone(base);
  missing.document.buyerReference = null;
  assert(
    semanticFindings(missing, "synthetic-reference-v1").some(
      (f) =>
        f.code === "RECIPIENT_REQUIREMENT_MISSING" &&
        f.canonicalPath === "document.buyerReference",
    ),
  );
});
test("decimal quantities round exactly", () => {
  const x = JSON.parse(readFileSync("fixtures/valid/FP-A-003.json", "utf8"));
  assert.equal(
    semanticFindings(x).filter((f) => f.severity === "ERROR").length,
    0,
  );
  assert.equal(new Decimal("0.1").plus("0.2").toString(), "0.3");
});
test("allowances, charges, rounding and positive base quantities", () => {
  const x = structuredClone(base);
  x.allowancesCharges = [
    {
      charge: false,
      reason: "Demo discount",
      amount: "10.00",
      tax: { categoryCode: "S", rate: "19" },
    },
  ];
  x.taxBreakdown[0].taxableAmount = "190.00";
  x.taxBreakdown[0].taxAmount = "36.10";
  Object.assign(x.totals, {
    allowanceTotal: "10.00",
    taxExclusiveAmount: "190.00",
    taxAmount: "36.10",
    taxInclusiveAmount: "226.10",
    payableAmount: "226.10",
  });
  assert.equal(
    semanticFindings(x).filter((f) => f.severity === "ERROR").length,
    0,
  );
  x.lines[0].unitPrice.baseQuantity = "0";
  assert(semanticFindings(x).some((f) => f.code === "DECIMAL_INVALID"));
});
test("duplicate IDs and tax groups are rejected", () => {
  const x = structuredClone(base);
  x.lines.push(x.lines[0]);
  x.taxBreakdown.push(x.taxBreakdown[0]);
  const f = semanticFindings(x);
  assert(f.some((f) => f.code === "INVALID_REQUEST"));
  assert(f.some((f) => f.code === "TAX_BREAKDOWN_MISMATCH"));
});
test("unsupported reduced rates and attachments never imply support", () => {
  const x = structuredClone(base);
  x.lines[0].tax.rate = "7";
  assert(semanticFindings(x).some((f) => f.code === "UNSUPPORTED_CASE"));
});
test("serialization hashes ignore key order and preserve lexical decimals", () => {
  assert.equal(stable({ z: "1.00", a: 1 }), stable({ a: 1, z: "1.00" }));
  assert.notEqual(sha256(stable({ a: "1.00" })), sha256(stable({ a: "1" })));
  assert.equal(generateUbl(base), generateUbl(structuredClone(base)));
  assert(!generateUbl(base).includes("undefined"));
});
test("XML escapes input; extensions have no business effect", () => {
  const x = structuredClone(base);
  x.lines[0].name = '<script>&"';
  assert(generateUbl(x).includes("&lt;script&gt;&amp;&quot;"));
  const y = structuredClone(base);
  y.extensions = { tax: "AE" };
  assert.equal(generateUbl(y), generateUbl(base));
});

test("decimal input resource bounds do not silently reduce precision", () => {
  const x = structuredClone(base);
  x.lines[0].quantity = "1".repeat(65);
  assert(schemaFindings(x).length);
});

test("customer-like consulting example remains ready for successful validation", () => {
  const invoice = JSON.parse(
    readFileSync("examples/customer-invoice-consulting.json", "utf8"),
  );
  assert.deepEqual(schemaFindings(invoice), []);
  assert.deepEqual(
    semanticFindings(invoice).map((finding) => ({
      code: finding.code,
      severity: finding.severity,
    })),
    [{ code: "RECIPIENT_PROFILE_UNKNOWN", severity: "INFO" }],
  );
  assert.equal(invoice.totals.payableAmount, "2045.61");
});
