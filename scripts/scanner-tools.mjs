import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { resolve, join } from "node:path";
export const scannerLock = JSON.parse(
  readFileSync("infra/security/scanners.lock.json", "utf8"),
);
export function scannerTools(work) {
  const platform = `${process.platform}-${process.arch}`;
  const cache = resolve(".data/scanner-downloads");
  mkdirSync(cache, { recursive: true, mode: 0o700 });
  const tools = {};
  for (const name of ["syft", "grype"]) {
    const artifact = scannerLock[name].archives[platform];
    if (!artifact) throw Error(`Unsupported scanner platform: ${platform}`);
    const url = new URL(artifact.url);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "github.com" ||
      !url.pathname.startsWith(`/anchore/${name}/releases/download/`) ||
      !/^[a-f0-9]{64}$/.test(artifact.sha256)
    )
      throw Error("Invalid scanner lock");
    const archive = join(cache, artifact.sha256 + ".tar.gz");
    if (!existsSync(archive)) {
      // No shell scripts are downloaded or executed. Only the hashed archive is extracted.
      const download = execFileSync(
        "curl",
        [
          "--disable",
          "--fail",
          "--location",
          "--silent",
          "--show-error",
          "--proto",
          "=https",
          "--proto-redir",
          "=https",
          "--max-time",
          "180",
          url.href,
        ],
        { maxBuffer: 128 * 1024 * 1024, timeout: 190000 },
      );
      if (
        createHash("sha256").update(download).digest("hex") !== artifact.sha256
      )
        throw Error("Scanner archive checksum mismatch");
      writeFileSync(archive, download, { mode: 0o600 });
    }
    if (
      createHash("sha256").update(readFileSync(archive)).digest("hex") !==
      artifact.sha256
    )
      throw Error("Cached scanner archive checksum mismatch");
    const destination = mkdtempSync(join(work, `${name}-`));
    try {
      execFileSync("tar", ["-xzf", archive, "-C", destination, name], {
        timeout: 30000,
      });
    } catch (error) {
      rmSync(destination, { recursive: true, force: true });
      throw error;
    }
    tools[name] = join(destination, name);
  }
  return tools;
}
