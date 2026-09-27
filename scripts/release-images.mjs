import { scanImage } from "./scan-image.mjs";
import {
  evaluateImageLicenses,
  validateImageInventory,
} from "./security-policy.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
const revision = run("git", ["rev-parse", "HEAD"]).trim();
if (run("git", ["status", "--porcelain"]).trim())
  throw Error("Commit the working tree before creating release evidence.");
const directory = resolve(".data/releases", `${revision}-${Date.now()}`);
mkdirSync(directory, { recursive: true, mode: 0o700 });
const hash = (value) => createHash("sha256").update(value).digest("hex");
const files = {};
function save(name, value) {
  const bytes =
    typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n";
  writeFileSync(join(directory, name), bytes, { mode: 0o600 });
  files[name] = hash(bytes);
}
if (process.env.VERIFICATION_LOG)
  save("verification.log", readFileSync(process.env.VERIFICATION_LOG, "utf8"));
const images = {};
const security = {};
const policy = JSON.parse(readFileSync("infra/security/policy.json", "utf8"));
for (const target of ["web", "worker"]) {
  const tag = `fakturapass-${target}:${revision}`;
  console.log(`Building ${target} for ${revision}`);
  const metadata = join(directory, `${target}-build.json`);
  run(
    "docker",
    [
      "buildx",
      "build",
      "--load",
      "--metadata-file",
      metadata,
      "--target",
      target,
      "--build-arg",
      `SOURCE_REVISION=${revision}`,
      "-f",
      "infra/app/Dockerfile",
      "-t",
      tag,
      ".",
    ],
    { stdio: "inherit" },
  );
  files[`${target}-build.json`] = hash(readFileSync(metadata));
  const image = JSON.parse(run("docker", ["image", "inspect", tag]))[0];
  if (image.Config.Labels["org.opencontainers.image.revision"] !== revision)
    throw Error("Image revision mismatch");
  images[target] = {
    tag,
    id: image.Id,
    architecture: image.Architecture,
    os: image.Os,
    repoDigests: image.RepoDigests,
  };
  save(`${target}-image.json`, image);
  const sbom = run("docker", [
    "run",
    "--rm",
    "--entrypoint",
    "cat",
    image.Id,
    "/app/release/npm-sbom.cdx.json",
  ]);
  const parsed = JSON.parse(sbom);
  if (parsed.bomFormat !== "CycloneDX" || !parsed.components?.length)
    throw Error("Missing dependency inventory");
  save(`${target}-npm-sbom.cdx.json`, sbom);
  const vulnerabilities = scanImage(image.Id, target, directory);
  const installed = JSON.parse(
    readFileSync(join(directory, `${target}-sbom.syft.json`), "utf8"),
  );
  const osType = validateImageInventory(installed);
  const licenses = evaluateImageLicenses(installed, policy);
  save(`${target}-licenses.json`, licenses);
  for (const suffix of [
    "sbom.syft.json",
    "sbom.spdx.json",
    "vulnerabilities.json",
    "security.json",
  ]) {
    const name = `${target}-${suffix}`;
    files[name] = hash(readFileSync(join(directory, name)));
  }
  security[target] = {
    licenses: licenses.status,
    vulnerabilities: vulnerabilities.status,
  };
  save(`${target}-os-packages.json`, {
    distribution: installed.distro,
    packages: installed.artifacts
      .filter((a) => a.type === osType)
      .map((a) => ({
        name: a.name,
        version: a.version,
        purl: a.purl,
        licenses: a.licenses,
      })),
  });
}
save("security-summary.json", security);
if (
  Object.values(security).some(
    (result) =>
      result.licenses !== "passed" || result.vulnerabilities !== "passed",
  )
)
  throw Error(
    "Release security policy blocked promotion; inspect retained security and license reports. No final manifest was created.",
  );
console.log(
  "Testing the exact recorded image IDs against a disposable database",
);
const acceptance = run(process.execPath, ["scripts/test-containers.mjs"], {
  env: {
    ...process.env,
    WEB_IMAGE: images.web.id,
    WORKER_IMAGE: images.worker.id,
  },
});
save("container-acceptance.log", acceptance);
let audit;
try {
  audit = run("npm", ["audit", "--json"]);
} catch (error) {
  if (!error.stdout) throw error;
  audit = String(error.stdout);
}
save("npm-audit.json", audit);
const auditReport = JSON.parse(audit);
if (
  !auditReport.metadata?.vulnerabilities ||
  auditReport.metadata.vulnerabilities.high ||
  auditReport.metadata.vulnerabilities.critical
)
  throw Error(
    "Dependency audit failed; retained incomplete evidence is not a release",
  );
if (
  run("git", ["rev-parse", "HEAD"]).trim() !== revision ||
  run("git", ["status", "--porcelain"]).trim()
)
  throw Error("Source changed during release build");
save("manifest.json", {
  schemaVersion: "fakturapass.release.v1",
  revision,
  createdAt: new Date().toISOString(),
  lockfileSha256: hash(readFileSync("package-lock.json")),
  dockerfileSha256: hash(readFileSync("infra/app/Dockerfile")),
  validatorManifestSha256: hash(
    readFileSync("services/invoice-engine/dependencies.lock.json"),
  ),
  securityPolicySha256: hash(readFileSync("infra/security/policy.json")),
  scannerLockSha256: hash(readFileSync("infra/security/scanners.lock.json")),
  security,
  images,
  files: { ...files },
  scope:
    "Local image security and packaging acceptance; not production release approval or legal license approval. OS/application vulnerability scans and installed npm license policy passed.",
});
console.log(`Release evidence saved: ${directory}`);
