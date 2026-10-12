import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { XMLParser } from "fast-xml-parser";
import { scanImage } from "./scan-image.mjs";
import {
  evaluateImageLicenses,
  evaluateValidatorCoverage,
  validateImageInventory,
} from "./security-policy.mjs";
const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
const revision = run("git", ["rev-parse", "HEAD"]).trim();
if (run("git", ["status", "--porcelain"]).trim())
  throw Error("Commit the working tree before creating validator evidence.");
const directory = resolve(
  ".data/releases",
  `validator-${revision}-${Date.now()}`,
);
mkdirSync(directory, { recursive: true, mode: 0o700 });
const files = {};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function save(name, value) {
  const bytes =
    typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n";
  writeFileSync(join(directory, name), bytes, { mode: 0o600 });
  files[name] = hash(bytes);
}
console.log(`Validator evidence: ${directory}`);
run(process.execPath, ["scripts/setup-engine.mjs"], { stdio: "inherit" });
const tag = `fakturapass-validator:${revision}`;
run(
  "docker",
  [
    "build",
    "--build-arg",
    `SOURCE_REVISION=${revision}`,
    "-t",
    tag,
    "services/invoice-engine",
  ],
  { stdio: "inherit" },
);
const image = JSON.parse(run("docker", ["image", "inspect", tag]))[0];
if (image.Config.Labels["org.opencontainers.image.revision"] !== revision)
  throw Error("Validator image revision mismatch");
save("validator-image.json", image);
const lock = JSON.parse(
  readFileSync("services/invoice-engine/dependencies.lock.json"),
);
const jar = "services/invoice-engine/vendor/validator.jar";
const installedHash = run("docker", [
  "run",
  "--rm",
  "--read-only",
  "--entrypoint",
  "sha256sum",
  image.Id,
  "/engine/validator.jar",
]).split(/\s/)[0];
if (installedHash !== lock.components[0].sha256)
  throw Error("Installed validator checksum mismatch");
save("validator-inputs.json", {
  revision,
  jarSha256: installedHash,
  dependencies: lock,
  dockerfileSha256: hash(readFileSync("services/invoice-engine/Dockerfile")),
});
const entries = run("unzip", ["-Z1", jar]).trim().split("\n");
save("validator-jar-entries.json", entries);
const pomPath = "META-INF/maven/org.kosit/validator/pom.xml";
const pom = run("unzip", ["-p", jar, pomPath]);
save("validator-pom.xml", pom);
const project = new XMLParser().parse(pom).project;
const array = (v) => (v ? (Array.isArray(v) ? v : [v]) : []);
const expected = [
  {
    name: "validator",
    version: lock.components[0].version,
    evidence: "Pinned executable checksum",
  },
];
for (const d of array(project.dependencies?.dependency)) {
  if (["test", "provided", "system"].includes(d.scope)) continue;
  const version = String(d.version ?? "").replace(
    /\$\{([^}]+)\}/g,
    (_, key) => project.properties?.[key] ?? `UNRESOLVED:${key}`,
  );
  if (!version || version.includes("UNRESOLVED:"))
    throw Error(`Unresolved validator dependency version: ${d.artifactId}`);
  expected.push({
    name: d.artifactId,
    version,
    evidence: `${pomPath}: ${d.groupId}:${d.artifactId}`,
  });
}
// This transitive shaded library has classes but no Maven declaration in the executable.
if (
  entries.some((p) => p.startsWith("org/xmlresolver/") && p.endsWith(".class"))
)
  expected.push({
    name: "xmlresolver",
    evidence: "org/xmlresolver/*.class in pinned executable",
  });
const notices = entries.filter(
  (p) =>
    /(^|[/.])(license|notice|copying)([./_-]|$)/i.test(p) && !p.endsWith("/"),
);
save(
  "validator-notices.json",
  notices.map((path) => {
    const text = run("unzip", ["-p", jar, path]);
    return { path, sha256: hash(text), text };
  }),
);
const vulnerabilities = scanImage(
  image.Id,
  "validator",
  directory,
  "validator",
);
const sbom = JSON.parse(
  readFileSync(join(directory, "validator-sbom.syft.json")),
);
const osType = validateImageInventory(sbom, "validator");
const policy = JSON.parse(readFileSync("infra/security/policy.json"));
const licenses = evaluateImageLicenses(sbom, policy, "validator");
const coverage = evaluateValidatorCoverage(sbom, expected);
save("validator-licenses.json", licenses);
save("validator-coverage.json", coverage);
save("validator-os-packages.json", {
  distribution: sbom.distro,
  packages: sbom.artifacts.filter((a) => a.type === osType),
});
save("security-summary.json", {
  vulnerabilities: vulnerabilities.status,
  licenses: licenses.status,
  coverage: coverage.status,
});
for (const suffix of [
  "sbom.syft.json",
  "sbom.spdx.json",
  "vulnerabilities.json",
  "security.json",
])
  files[`validator-${suffix}`] = hash(
    readFileSync(join(directory, `validator-${suffix}`)),
  );
if ([vulnerabilities, licenses, coverage].some((r) => r.status !== "passed"))
  throw Error(
    "Validator security policy blocked; inspect retained reports. No final manifest was created.",
  );
if (
  run("git", ["rev-parse", "HEAD"]).trim() !== revision ||
  run("git", ["status", "--porcelain"]).trim()
)
  throw Error("Source changed during validator scan");
save("manifest.json", {
  schemaVersion: "fakturapass.validator-security.v1",
  revision,
  createdAt: new Date().toISOString(),
  imageId: image.Id,
  policySha256: hash(readFileSync("infra/security/policy.json")),
  scannerLockSha256: hash(readFileSync("infra/security/scanners.lock.json")),
  files: { ...files },
  scope:
    "Local validator security checks; functional, rule-configuration notice and production acceptance remain separate",
});
console.log(`Validator security evidence saved: ${directory}`);
