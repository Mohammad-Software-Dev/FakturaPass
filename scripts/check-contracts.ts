import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import YAML from "yaml";
import { schemaFindings } from "../packages/domain";
const spec = YAML.parse(
  readFileSync("packages/contracts/openapi.yaml", "utf8"),
);
assert.equal(spec.openapi, "3.1.0");
const expected = [
  "listRecipientProfiles",
  "publishRecipientProfile",
  "listRecipientProfileVersions",
  "listMappingRecipes",
  "previewCsv",
  "importCsv",
  "createInvoice",
  "listInvoices",
  "getInvoice",
  "getInvoiceRevision",
  "createInvoiceRevision",
  "validateInvoiceRevision",
  "getValidationRun",
  "approveInvoiceRevision",
  "generateInvoiceArtifact",
  "getArtifact",
  "downloadArtifact",
  "getInvoiceEvidence",
  "getRecipientProfile",
  "healthLive",
  "healthReady",
];
const ids = [];
for (const [path, methods] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(methods as any)) {
    const operation = op as any;
    assert(operation.responses);
    assert(Array.isArray(operation.security));
    assert(operation.parameters);
    if (method === "post") assert(operation.requestBody);
    if (!path.startsWith("/health")) assert(operation.security.length);
    ids.push(operation.operationId);
  }
}
assert.deepEqual(ids.sort(), expected.sort());
assert.deepEqual(
  schemaFindings(
    JSON.parse(readFileSync("fixtures/valid/FP-A-001.json", "utf8")),
  ),
  [],
);
assert.equal(
  spec.components.schemas.Invoice.properties.totals.properties.payableAmount
    .type,
  "string",
);
console.log(
  `OpenAPI 3.1 contract: ${ids.length} operations, canonical fixture and decimal types verified.`,
);
