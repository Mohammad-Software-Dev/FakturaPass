import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { enrichValidatorInventory } from "../scripts/validator-metadata.mjs";
const pom = Buffer.from(
  "<project><groupId>org.xmlresolver</groupId><artifactId>xmlresolver</artifactId><version>5.3.3</version><licenses><license><url>https://www.apache.org/licenses/LICENSE-2.0</url></license></licenses></project>",
);
const path = "/engine/distribution/libs/xmlresolver-5.3.3-data.jar";
const record = {
  path,
  sha256: "a".repeat(64),
  groupId: "org.xmlresolver",
  artifactId: "xmlresolver",
  version: "5.3.3",
  classifier: "data",
  pom: "xmlresolver.pom",
  pomSha256: createHash("sha256").update(pom).digest("hex"),
  licenseExpression: "Apache-2.0",
  licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
};
const raw = {
  artifacts: [
    {
      id: "keep",
      type: "java-archive",
      name: "xmlresolver",
      version: "5.3.3-data",
      purl: "pkg:maven/wrong/xmlresolver@5.3.3-data",
      locations: [{ path }],
      licenses: [],
      cpes: [{ cpe: "cpe:2.3:a:vendor:xmlresolver:5.3.3-data:*:*:*:*:*:*:*" }],
    },
  ],
};
const lock = (r) => ({
  schemaVersion: "fakturapass.validator-metadata.v1",
  records: r,
});
const apply = (
  r = record,
  input = raw,
  verified = { [path]: record.sha256 },
  bytes = pom,
) => enrichValidatorInventory(input, lock([r]), verified, () => bytes);
test("Verified Maven metadata supplements identity and license without mutating raw evidence", () => {
  const before = structuredClone(raw);
  const result = apply();
  assert.deepEqual(raw, before);
  assert.equal(result.inventory.artifacts[0].id, "keep");
  assert.equal(result.inventory.artifacts[0].version, "5.3.3");
  assert.equal(
    result.inventory.artifacts[0].purl,
    "pkg:maven/org.xmlresolver/xmlresolver@5.3.3?classifier=data",
  );
  assert.equal(
    result.inventory.artifacts[0].licenses[0].spdxExpression,
    "Apache-2.0",
  );
  assert.match(result.inventory.artifacts[0].cpes[0].cpe, /:5\.3\.3:/);
  assert.equal(result.changes[0].before.version, "5.3.3-data");
});
test("Unverified bytes, declarations, paths and ambiguous artifacts fail closed", () => {
  assert.throws(() => apply(record, raw, {}));
  assert.throws(() => apply(record, raw, { [path]: "b".repeat(64) }));
  assert.throws(() => apply(record, raw, undefined, Buffer.from("changed")));
  for (const patch of [
    { pom: "../outside.pom" },
    { version: "5.3.4" },
    { groupId: "fake" },
    { classifier: "other" },
    { licenseExpression: "MIT" },
    { licenseUrl: "https://unknown.test" },
  ])
    assert.throws(() => apply({ ...record, ...patch }));
  assert.throws(() => apply(record, { artifacts: [] }));
  assert.throws(() =>
    apply(record, { artifacts: [...raw.artifacts, ...raw.artifacts] }),
  );
  assert.throws(() =>
    enrichValidatorInventory(
      raw,
      lock([record, record]),
      { [path]: record.sha256 },
      () => pom,
    ),
  );
  assert.throws(() =>
    apply(record, {
      artifacts: [
        { ...raw.artifacts[0], licenses: [{ value: "GPL-3.0-only" }] },
      ],
    }),
  );
});
