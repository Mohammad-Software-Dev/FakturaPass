import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateScanTarget,
  validateImageInventory,
  evaluateLicenses,
  evaluateImageLicenses,
  evaluateVulnerabilities,
  evaluateValidatorCoverage,
} from "../scripts/security-policy.mjs";
const policy = JSON.parse(readFileSync("infra/security/policy.json", "utf8"));
const bom = (licenses) => ({
  bomFormat: "CycloneDX",
  components: [{ name: "example", version: "1.0", licenses }],
});
const finding = (severity = "High", version = "1.0") => ({
  vulnerability: {
    id: "CVE-TEST",
    severity,
    fix: { state: "not-fixed", versions: [] },
  },
  artifact: { name: "example", version, purl: `pkg:npm/example@${version}` },
});
const report = (matches, built = new Date().toISOString()) => ({
  matches,
  source: { type: "image" },
  descriptor: { version: "test", db: { status: { valid: true, built } } },
});
test("Missing licenses and unfamiliar expressions block; exact allowed declarations pass", () => {
  assert.equal(
    evaluateLicenses(bom([{ license: { id: "MIT" } }]), policy).status,
    "passed",
  );
  for (const licenses of [
    [],
    [{}],
    [{ expression: "MIT OR GPL-3.0-only" }],
    [{ license: { id: "LicenseRef-Custom" } }],
    [{ license: { id: "LGPL-3.0-or-later" } }],
  ])
    assert.equal(evaluateLicenses(bom(licenses), policy).status, "blocked");
});
test("Empty or malformed SBOMs cannot pass as clean inventories", () => {
  for (const value of [
    {},
    { bomFormat: "CycloneDX", components: [] },
    bom([{ license: { id: "MIT" } }]),
  ]) {
    if (value.components?.length) delete value.components[0].version;
    assert.throws(() => evaluateLicenses(value, policy));
  }
});
test("High, critical and unknown findings block even when no fix exists", () => {
  for (const severity of [
    "High",
    "Critical",
    "Unknown",
    "UNEXPECTED",
    undefined,
  ]) {
    const match = finding(severity);
    if (severity === undefined) delete match.vulnerability.severity;
    assert.equal(
      evaluateVulnerabilities(report([match]), policy).status,
      "blocked",
    );
  }
  const result = evaluateVulnerabilities(report([finding("Medium")]), policy);
  assert.equal(result.status, "passed");
  assert.equal(result.findings.length, 1);
});
test("Missing reports and hidden findings fail closed", () => {
  for (const value of [
    {},
    { matches: [] },
    { ...report([]), ignoredMatches: [finding()] },
  ])
    assert.throws(() => evaluateVulnerabilities(value, policy));
});
test("Exceptions require justification, ownership and expiry and match exact package versions", () => {
  const exception = {
    id: "CVE-TEST",
    package: "example",
    purl: "pkg:npm/example@1.0",
    version: "1.0",
    reason: "test fixture",
    owner: "test reviewer",
    reference: "synthetic review",
    expiresAt: "2026-10-01T00:00:00Z",
  };
  const now = new Date();
  exception.expiresAt = new Date(now.getTime() + 86400000).toISOString();
  const configured = { ...policy, exceptions: [exception] };
  assert.equal(
    evaluateVulnerabilities(report([finding()]), configured, now).findings[0]
      .status,
    "excepted",
  );
  assert.equal(
    evaluateVulnerabilities(report([finding("High", "2.0")]), configured, now)
      .status,
    "blocked",
  );
  assert.throws(() =>
    evaluateVulnerabilities(
      report([]),
      configured,
      new Date(now.getTime() + 172800000),
    ),
  );
  for (const field of [
    "reason",
    "owner",
    "reference",
    "expiresAt",
    "package",
    "purl",
    "version",
    "id",
  ]) {
    const broken = { ...exception };
    delete broken[field];
    assert.throws(() =>
      evaluateVulnerabilities(
        report([]),
        { ...policy, exceptions: [broken] },
        now,
      ),
    );
  }
});

test("Scan destinations reject path traversal and mutable tags", () => {
  const digest = "sha256:" + "a".repeat(64);
  validateScanTarget(digest, "web");
  for (const target of ["../outside", "/tmp/out", "web/a", "--flag", ""])
    assert.throws(() => validateScanTarget(digest, target));
  assert.throws(() => validateScanTarget("web:latest", "web"));
});

test("Missing, stale, invalid and future databases cannot pass", () => {
  const now = new Date("2026-09-27T12:00:00Z");
  assert.equal(
    evaluateVulnerabilities(report([], now.toISOString()), policy, now).status,
    "passed",
  );
  for (const built of [
    undefined,
    "invalid",
    "2026-09-22T11:59:59Z",
    "2026-09-28T12:00:00Z",
  ]) {
    const value = report([], built);
    value.descriptor.db.status.built = built;
    assert.throws(() => evaluateVulnerabilities(value, policy, now));
  }
  const value = report([]);
  value.descriptor.db.status.valid = false;
  assert.throws(() => evaluateVulnerabilities(value, policy));
  delete value.descriptor.db;
  assert.throws(() => evaluateVulnerabilities(value, policy));
});
test("Malformed policy cannot weaken the release gate", () => {
  for (const patch of [
    { blockedSeverities: [] },
    { maxDatabaseAgeHours: 0 },
    { exceptions: null },
    { allowedDependencyLicenseExpressions: [] },
  ]) {
    assert.throws(() =>
      evaluateVulnerabilities(report([]), { ...policy, ...patch }),
    );
    assert.throws(() =>
      evaluateLicenses(bom([{ license: { id: "MIT" } }]), {
        ...policy,
        ...patch,
      }),
    );
  }
});

test("Image license gate covers bundled dependencies and only excludes the exact first-party root", () => {
  const artifact = (
    name,
    licenses,
    path = "/app/node_modules/example/package.json",
  ) => ({
    type: "npm",
    name,
    version: "1.0",
    licenses: licenses.map((value) => ({ value })),
    locations: [{ path }],
  });
  const sbom = (artifacts) => ({ source: { type: "image" }, artifacts });
  const root = artifact("fakturapass", [], "/app/package.json");
  const good = artifact("example", ["MIT"]);
  assert.equal(
    evaluateImageLicenses(sbom([root, good]), policy).status,
    "passed",
  );
  for (const a of [
    artifact("bundled", []),
    artifact("codec", ["LGPL-3.0-or-later"]),
    artifact("fakturapass", []),
  ])
    assert.equal(
      evaluateImageLicenses(sbom([root, good, a]), policy).status,
      "blocked",
    );
  assert.throws(() => evaluateImageLicenses(sbom([root]), policy));
  assert.throws(() => evaluateImageLicenses({}, policy));
});

test("Image inventory requires OS-specific packages and application coverage", () => {
  const inventory = (id, types) => ({
    source: { type: "image" },
    distro: { id },
    artifacts: types.map((type) => ({ type })),
  });
  assert.equal(
    validateImageInventory(inventory("debian", ["deb", "npm"])),
    "deb",
  );
  assert.equal(
    validateImageInventory(inventory("alpine", ["apk", "npm"])),
    "apk",
  );
  for (const input of [
    inventory("alpine", ["deb", "npm"]),
    inventory("alpine", ["apk"]),
    inventory("debian", ["npm"]),
    inventory("unknown", ["deb", "npm"]),
    {},
  ])
    assert.throws(() => validateImageInventory(input));
});

const javaArtifact = (
  name,
  version = "1.0",
  path = "/engine/validator.jar",
  licenses = ["Apache-2.0"],
) => ({
  type: "java-archive",
  name,
  version,
  locations: [{ path }],
  licenses: licenses.map((value) => ({ value })),
});
const javaInventory = (artifacts) => ({
  source: { type: "image" },
  distro: { id: "ubuntu" },
  artifacts: [{ type: "deb" }, ...artifacts],
});
test("Validator coverage requires the executable at its exact path without weakening npm checks", () => {
  const valid = javaInventory([javaArtifact("validator")]);
  assert.equal(validateImageInventory(valid, "validator"), "deb");
  assert.throws(() => validateImageInventory(valid));
  assert.throws(() => validateImageInventory(valid, "typo"));
  assert.throws(() =>
    validateImageInventory(javaInventory([javaArtifact("other")]), "validator"),
  );
  assert.throws(() =>
    validateImageInventory(
      javaInventory([javaArtifact("validator", "1.0", "/other.jar")]),
      "validator",
    ),
  );
  assert.throws(() => evaluateImageLicenses(valid, policy, "typo"));
});
test("Java license checks include shaded libraries and JRE archives with no first-party exemption", () => {
  const root = javaArtifact("validator");
  assert.equal(
    evaluateImageLicenses(javaInventory([root]), policy, "validator").status,
    "passed",
  );
  for (const a of [
    javaArtifact("shaded", "1.0", undefined, []),
    javaArtifact("jrt-fs", "25", "/opt/java/lib/jrt-fs.jar", []),
    javaArtifact("fakturapass", "1.0", "/app/package.json", []),
    javaArtifact("restricted", "1.0", undefined, ["MPL-2.0"]),
  ])
    assert.equal(
      evaluateImageLicenses(javaInventory([root, a]), policy, "validator")
        .status,
      "blocked",
    );
});
test("Shaded dependency coverage rejects missing, misplaced and mismatched versions", () => {
  const expected = [
    { name: "Saxon-HE", version: "12.9", evidence: "Pinned executable POM" },
  ];
  const root = javaArtifact("validator");
  const good = javaArtifact("Saxon-HE", "12.9");
  assert.equal(
    evaluateValidatorCoverage(javaInventory([root, good]), expected).status,
    "passed",
  );
  for (const artifacts of [
    [root],
    [root, javaArtifact("Saxon-HE", "12.9", "/different.jar")],
    [root, javaArtifact("Saxon-HE", "UNKNOWN")],
    [root, javaArtifact("Saxon-HE", "12.8")],
  ])
    assert.equal(
      evaluateValidatorCoverage(javaInventory(artifacts), expected).status,
      "blocked",
    );
  assert.throws(() => evaluateValidatorCoverage(javaInventory([root]), []));
  assert.throws(() =>
    evaluateValidatorCoverage(javaInventory([root]), [{ name: "Saxon-HE" }]),
  );
});
