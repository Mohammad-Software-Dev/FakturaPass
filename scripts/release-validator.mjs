import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { enrichValidatorInventory } from "./validator-metadata.mjs";
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
const distribution = JSON.parse(
  readFileSync("services/invoice-engine/distribution.lock.json"),
);
const localRoot = "services/invoice-engine/vendor/distribution";
const installed = run("docker", [
  "run",
  "--rm",
  "--read-only",
  "--entrypoint",
  "sha256sum",
  image.Id,
  ...distribution.files.map((f) => `/engine/distribution/${f.path}`),
])
  .trim()
  .split("\n");
if (installed.length !== distribution.files.length)
  throw Error("Incomplete installed distribution checksums");
const verifiedFiles = {};
distribution.files.forEach((f, i) => {
  verifiedFiles[`/engine/distribution/${f.path}`] = installed[i].split(/\s/)[0];
  if (installed[i].split(/\s/)[0] !== f.sha256)
    throw Error(`Installed library checksum mismatch: ${f.path}`);
});
save("validator-inputs.json", {
  revision,
  dependencies: lock,
  distribution,
  dockerfileSha256: hash(readFileSync("services/invoice-engine/Dockerfile")),
});
const expected = [];
const libraries = [];
for (const file of distribution.files) {
  if (!file.path.endsWith(".jar")) continue;
  const jar = `${localRoot}/${file.path}`;
  const entries = run("unzip", ["-Z1", jar]).trim().split("\n");
  const match = file.path
    .split("/")
    .pop()
    .match(/^(.+?)-(\d+\.\d+.*?)(?:-data)?\.jar$/);
  if (!match) throw Error(`Unidentified library file: ${file.path}`);
  expected.push({
    name: match[1],
    version: match[2],
    path: `/engine/distribution/${file.path}`,
    evidence: `Official ZIP member SHA-256 ${file.sha256}`,
  });
  const evidence = entries.filter(
    (p) =>
      !p.endsWith("/") &&
      ((/license|notice|copying/i.test(p) && !p.endsWith(".class")) ||
        /pom\.(xml|properties)$/.test(p) ||
        p === "META-INF/MANIFEST.MF"),
  );
  libraries.push({
    path: file.path,
    sha256: file.sha256,
    entries,
    evidence: evidence.map((path) => {
      const text = run("unzip", ["-p", jar, path]);
      return { path, sha256: hash(text), text };
    }),
  });
}
save("validator-library-evidence.json", libraries);
save(
  "validator-notices.json",
  distribution.files
    .filter((f) => !f.path.endsWith(".jar"))
    .map((f) => ({
      ...f,
      text: readFileSync(`${localRoot}/${f.path}`, "utf8"),
    })),
);
const metadataRoot = "services/invoice-engine/metadata";
const metadataLock = JSON.parse(
  readFileSync(`${metadataRoot}/provenance.lock.json`),
);
save("validator-metadata-inputs.json", metadataLock);
for (const name of new Set(metadataLock.records.map((r) => r.pom))) {
  if (!/^[a-zA-Z0-9_.-]+\.pom$/.test(name))
    throw Error("Unsafe metadata evidence path");
  save(`upstream-${name}`, readFileSync(`${metadataRoot}/${name}`, "utf8"));
}
const jrePaths = [
  "/opt/java/openjdk/legal/java.base/LICENSE",
  "/opt/java/openjdk/legal/java.base/ADDITIONAL_LICENSE_INFO",
  "/opt/java/openjdk/legal/java.base/ASSEMBLY_EXCEPTION",
];
save(
  "validator-jre-notices.json",
  jrePaths.map((path) => {
    const text = run("docker", [
      "run",
      "--rm",
      "--read-only",
      "--entrypoint",
      "cat",
      image.Id,
      path,
    ]);
    return { path, sha256: hash(text), text };
  }),
);
const vulnerabilities = scanImage(
  image.Id,
  "validator",
  directory,
  "validator",
  (raw) =>
    enrichValidatorInventory(raw, metadataLock, verifiedFiles, (name) =>
      readFileSync(`${metadataRoot}/${name}`),
    ),
);

const sbom = JSON.parse(
  readFileSync(join(directory, "validator-sbom.enriched.syft.json")),
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
  "sbom.enriched.syft.json",
  "metadata-enrichment.json",
  "vulnerabilities.enriched.json",
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
