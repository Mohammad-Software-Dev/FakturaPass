import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { validateScanTarget } from "./security-policy.mjs";
import { scanImage } from "./scan-image.mjs";
const [imageId, target = "image"] = process.argv.slice(2);
validateScanTarget(imageId, target);
const directory = resolve(".data/security-reports", `${target}-${Date.now()}`);
mkdirSync(directory, { recursive: true, mode: 0o700 });
try {
  const report = scanImage(imageId, target, directory);
  console.log(
    JSON.stringify({
      status: report.status,
      directory,
      blocked: report.findings.filter((f) => f.status === "blocked").length,
    }),
  );
  if (report.status !== "passed") process.exitCode = 1;
} catch (error) {
  console.error(
    `Security scan failed; no release approval. Evidence directory: ${directory}`,
  );
  throw error;
}
