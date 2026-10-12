import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const manifest = JSON.parse(
  await readFile("services/invoice-engine/dependencies.lock.json", "utf8"),
);
const distribution = JSON.parse(
  await readFile("services/invoice-engine/distribution.lock.json", "utf8"),
);
const dir = "services/invoice-engine/vendor";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
await mkdir(dir, { recursive: true });
for (const [n, c] of manifest.components.entries()) {
  const path = `${dir}/${n === 0 ? "distribution.zip" : "config.zip"}`;
  let bytes;
  try {
    bytes = await readFile(path);
  } catch {
    const response = await fetch(c.upstreamUrl);
    if (!response.ok) throw Error(`Download failed: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (hash(bytes) !== c.sha256)
      throw Error(`Checksum mismatch for ${c.component}`);
    await writeFile(path, bytes);
  }
  if (hash(bytes) !== c.sha256)
    throw Error(`Checksum mismatch for ${c.component}`);
}
if (distribution.archiveSha256 !== manifest.components[0].sha256)
  throw Error("Distribution lock does not match download");
const entries = execFileSync("unzip", ["-Z1", `${dir}/distribution.zip`], {
  encoding: "utf8",
})
  .trim()
  .split("\n");
const actual = entries.filter((p) => !p.endsWith("/")).sort();
const expected = distribution.files.map((f) => f.path).sort();
if (
  entries.some(
    (p) =>
      !/^[a-zA-Z0-9_./-]+$/.test(p) ||
      p.startsWith("/") ||
      p.split("/").includes(".."),
  ) ||
  JSON.stringify(actual) !== JSON.stringify(expected)
)
  throw Error("Unexpected distribution archive entries");
// Recreate only this generated directory so obsolete libraries cannot remain on the classpath.
await rm(`${dir}/distribution`, { recursive: true, force: true });
await mkdir(`${dir}/distribution`, { recursive: true });
execFileSync("unzip", [
  "-qo",
  `${dir}/distribution.zip`,
  "-d",
  `${dir}/distribution`,
]);
for (const f of distribution.files) {
  if (hash(await readFile(`${dir}/distribution/${f.path}`)) !== f.sha256)
    throw Error(`Distribution file checksum mismatch: ${f.path}`);
}
await writeFile(
  `${dir}/distribution/SHA256SUMS`,
  distribution.files.map((f) => `${f.sha256}  ${f.path}`).join("\n") + "\n",
);
execFileSync("unzip", ["-qo", `${dir}/config.zip`, "-d", `${dir}/config`]);
console.log(
  "Pinned engine distribution, library files and configuration checksums verified.",
);
