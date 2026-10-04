import config from "../apps/web/next.config.mjs";
import { createRequire } from "node:module";
import {
  readdirSync,
  mkdirSync,
  copyFileSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
const { nodeFileTrace } = createRequire(import.meta.url)(
  "next/dist/compiled/@vercel/nft",
);
const target = ".data/runtime-dependencies";
rmSync(target, { recursive: true, force: true });
const entries = readdirSync(".data/runtime")
  .filter((f) => f.endsWith(".mjs"))
  .map((f) => join(".data/runtime", f));
const result = await nodeFileTrace(entries, {
  base: process.cwd(),
  processCwd: process.cwd(),
});
for (const warning of result.warnings) {
  // These are pg's optional native driver and non-Node Cloudflare adapter.
  if (
    !["pg-native", "cloudflare:sockets"].some((name) =>
      warning.message.startsWith(`Failed to resolve dependency "${name}":`),
    )
  )
    throw warning;
}
for (const file of result.fileList) {
  if (!file.startsWith("node_modules/")) continue;
  const dest = join(target, file);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(file, dest);
}
function preserveNoticesAndCheck(root, current = root) {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) preserveNoticesAndCheck(root, path);
    else if (entry.name.endsWith(".node"))
      throw Error(
        `Native addon cannot cross the build/runtime libc boundary: ${path}`,
      );
  }
  if (!existsSync(join(current, "package.json"))) return;
  const relative = current.slice(root.length + 1);
  if (!relative.startsWith("node_modules/")) return;
  if (!existsSync(relative))
    throw Error(`Cannot establish package provenance: ${relative}`);
  for (const name of readdirSync(relative)) {
    if (!/^(license|copying|notice)(\..*)?$/i.test(name)) continue;
    const source = join(relative, name);
    // License subdirectories are uncommon; require explicit handling instead of silently skipping them.
    copyFileSync(source, join(current, name));
  }
}
// Next traces its conditional image optimizer even when it is disabled.
// Remove whole unused codec packages, not their metadata or scan findings.
if (config.images?.unoptimized !== true)
  throw Error("Codec-free runtime requires unoptimized images");
const standalone = "apps/web/.next/standalone";
// Turbopack retains the SWC fallback downloader in its server trace. This
// precompiled runtime must never install a compiler. Review on framework upgrades.
const nextRoot = join(standalone, "node_modules/next");
if (
  JSON.parse(readFileSync(join(nextRoot, "package.json"))).version !== "16.3.6"
)
  throw Error("Review compiler-download pruning for the new Next.js version");
const downloaders = new Set(["lib/download-swc.js", "esm/lib/download-swc.js"]);
function checkTarConsumers(directory, relative = "") {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) checkTarConsumers(path, name);
    else if (
      entry.name.endsWith(".js") &&
      readFileSync(path, "utf8").includes("next/dist/compiled/tar") &&
      !downloaders.has(name)
    )
      throw Error(`Unexpected tar consumer requires packaging review: ${name}`);
  }
}
checkTarConsumers(join(nextRoot, "dist"));
for (const path of [
  "dist/lib/download-swc.js",
  "dist/lib/download-swc.js.map",
  "dist/lib/download-swc.d.ts",
  "dist/esm/lib/download-swc.js",
  "dist/esm/lib/download-swc.js.map",
  "dist/compiled/tar",
])
  rmSync(join(nextRoot, path), { recursive: true, force: true });
rmSync(join(standalone, "node_modules/sharp"), {
  recursive: true,
  force: true,
});
const img = join(standalone, "node_modules/@img");
if (existsSync(img))
  for (const name of readdirSync(img)) {
    if (name.startsWith("sharp-"))
      rmSync(join(img, name), { recursive: true, force: true });
  }
// Generated standalone server.js and Next chunks use CommonJS; operator bundles use .mjs.
const { name, version } = JSON.parse(readFileSync("package.json", "utf8"));
writeFileSync(
  ".data/runtime/package.json",
  JSON.stringify({ name, version, private: true, type: "commonjs" }) + "\n",
);
preserveNoticesAndCheck(target);
preserveNoticesAndCheck("apps/web/.next/standalone");
console.log(
  `Packaged ${result.fileList.size} traced operator/worker files and retained dependency notices.`,
);
