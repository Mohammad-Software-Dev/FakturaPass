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
      "--provenance=mode=min",
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
  save(
    `${target}-licenses.json`,
    parsed.components.map((c) => ({
      name: c.name,
      version: c.version,
      licenses: c.licenses ?? [],
      reviewRequired: !c.licenses?.length,
    })),
  );
  save(
    `${target}-os-packages.tsv`,
    run("docker", [
      "run",
      "--rm",
      "--entrypoint",
      "dpkg-query",
      image.Id,
      "-W",
      "-f=${Package}\t${Version}\t${Architecture}\n",
    ]),
  );
}
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
  images,
  files: { ...files },
  scope:
    "Local image packaging acceptance; not production release approval. npm SBOM plus OS inventory; no OS CVE scan or legal license approval.",
});
console.log(`Release evidence saved: ${directory}`);
