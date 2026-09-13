import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const manifest = JSON.parse(
  await readFile("services/invoice-engine/dependencies.lock.json", "utf8"),
);
const dir = "services/invoice-engine/vendor";
await mkdir(dir, { recursive: true });
for (const [n, c] of manifest.components.entries()) {
  const path = `${dir}/${n === 0 ? "validator.jar" : "config.zip"}`;
  let bytes;
  try {
    bytes = await readFile(path);
  } catch {
    const response = await fetch(c.upstreamUrl);
    if (!response.ok) throw Error(`Download failed: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(path, bytes);
  }
  if (createHash("sha256").update(bytes).digest("hex") !== c.sha256)
    throw Error(`Checksum mismatch for ${c.component}`);
}
execFileSync("unzip", ["-qo", `${dir}/config.zip`, "-d", `${dir}/config`]);
console.log("Pinned engine and configuration checksums verified.");
