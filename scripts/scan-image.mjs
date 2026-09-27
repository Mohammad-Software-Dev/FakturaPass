import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { resolve, join } from "node:path";
import {
  evaluateVulnerabilities,
  validateScanTarget,
  validateImageInventory,
} from "./security-policy.mjs";
import { scannerLock, scannerTools } from "./scanner-tools.mjs";
const policy = JSON.parse(readFileSync("infra/security/policy.json", "utf8"));
const docker = (args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 20 * 60 * 1000,
  });
export function scanImage(imageId, target, directory) {
  validateScanTarget(imageId, target);
  const parent = resolve(".data/security-work"),
    cache = resolve(".data/security-cache");
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  mkdirSync(cache, { recursive: true, mode: 0o700 });
  const work = mkdtempSync(join(parent, "scan-"));
  const output = join(work, "output"),
    scratch = join(work, "scratch");
  mkdirSync(output);
  mkdirSync(scratch);
  const archive = join(work, "image.tar");
  const environment = {
    PATH: process.env.PATH,
    HOME: scratch,
    TMPDIR: scratch,
    XDG_CONFIG_HOME: scratch,
    XDG_CACHE_HOME: scratch,
    SYFT_CHECK_FOR_APP_UPDATE: "false",
    GRYPE_CHECK_FOR_APP_UPDATE: "false",
    GRYPE_DB_CACHE_DIR: cache,
    GRYPE_DB_VALIDATE_AGE: "true",
    GRYPE_DB_MAX_ALLOWED_BUILT_AGE: `${policy.maxDatabaseAgeHours}h`,
  };
  const execute = (binary, args) =>
    execFileSync(binary, args, {
      cwd: scratch,
      env: environment,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      timeout: 20 * 60 * 1000,
    });
  try {
    const tools = scannerTools(work);
    docker(["image", "save", "-o", archive, imageId]);
    console.log(`Inventorying ${target}`);
    execute(tools.syft, [
      "scan",
      `docker-archive:${archive}`,
      "-o",
      `syft-json=${join(output, "sbom.syft.json")}`,
      "-o",
      `spdx-json=${join(output, "sbom.spdx.json")}`,
    ]);
    const sbom = JSON.parse(
      readFileSync(join(output, "sbom.syft.json"), "utf8"),
    );
    validateImageInventory(sbom);
    for (const name of ["sbom.syft.json", "sbom.spdx.json"])
      copyFileSync(join(output, name), join(directory, `${target}-${name}`));
    rmSync(archive);
    console.log(`Scanning ${target} OS and application packages`);
    execute(tools.grype, [
      `sbom:${join(output, "sbom.syft.json")}`,
      "-o",
      "json",
      "--file",
      join(output, "vulnerabilities.json"),
    ]);
    const report = JSON.parse(
      readFileSync(join(output, "vulnerabilities.json"), "utf8"),
    );
    copyFileSync(
      join(output, "vulnerabilities.json"),
      join(directory, `${target}-vulnerabilities.json`),
    );
    if (
      report.descriptor?.version !== scannerLock.grype.version ||
      sbom.descriptor?.version !== scannerLock.syft.version
    )
      throw Error("Scanner version differs from the pinned lock");
    const result = evaluateVulnerabilities(report, policy);
    const evidence = {
      schemaVersion: "fakturapass.image-security.v1",
      imageId,
      scannedAt: new Date().toISOString(),
      scanners: scannerLock,
      policySha256: createHash("sha256")
        .update(readFileSync("infra/security/policy.json"))
        .digest("hex"),
      packages: sbom.artifacts.length,
      ...result,
    };
    writeFileSync(
      join(directory, `${target}-security.json`),
      JSON.stringify(evidence, null, 2) + "\n",
      { mode: 0o600 },
    );
    return evidence;
  } catch (error) {
    writeFileSync(
      join(directory, `${target}-security.json`),
      JSON.stringify(
        {
          schemaVersion: "fakturapass.image-security.v1",
          imageId,
          status: "error",
          code: "SCAN_UNAVAILABLE",
          scannedAt: new Date().toISOString(),
        },
        null,
        2,
      ) + "\n",
      { mode: 0o600 },
    );
    if (error.stderr)
      writeFileSync(
        join(directory, `${target}-scanner-error.log`),
        String(error.stderr),
        { mode: 0o600 },
      );
    throw error;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
