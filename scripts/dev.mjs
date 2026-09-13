import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, readFileSync } from "node:fs";
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}
process.env.FAKTURAPASS_ENV ??= "LOCAL";
process.env.LOCAL_BROWSER_IDENTITY ??= "enabled";
const host = "127.0.0.1";
const port = Number(process.env.PORT ?? 3010);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw Error("PORT must be an integer between 1 and 65535.");
async function assertPortAvailable() {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE")
        reject(
          Error(
            `FakturaPass cannot start because http://${host}:${port} is already in use. Stop the other local server or run PORT=3011 npm run dev.`,
          ),
        );
      else reject(error);
    });
    server.listen(port, host, () => server.close(resolve));
  });
}
try {
  await assertPortAvailable();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
execFileSync(
  "docker",
  ["compose", "-f", "infra/compose.yaml", "up", "-d", "--wait"],
  { stdio: "inherit" },
);
execFileSync(process.execPath, ["scripts/setup-engine.mjs"], {
  stdio: "inherit",
});
execFileSync(
  process.execPath,
  ["--import", "tsx", "packages/database/migrate.ts"],
  { stdio: "inherit" },
);
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => {
    if (child.exitCode == null) child.kill("SIGTERM");
  });
  setTimeout(() => process.exit(code), 250).unref();
}
function child(name, command, args, options = {}) {
  const processChild = spawn(command, args, {
    stdio: "inherit",
    ...options,
  });
  children.push(processChild);
  processChild.once("error", (error) => {
    console.error(`${name} failed to start: ${error.message}`);
    stop(1);
  });
  processChild.once("exit", (code, signal) => {
    if (!stopping) {
      console.error(
        `${name} stopped unexpectedly${signal ? ` (${signal})` : ` with exit code ${code}`}.`,
      );
      stop(code ?? 1);
    }
  });
  return processChild;
}
async function available(url) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok;
  } catch {
    return false;
  }
}
if (!(await available("http://127.0.0.1:8089/server/health")))
  child("Invoice engine", process.execPath, ["scripts/engine.mjs"], {
    stdio: ["pipe", "inherit", "inherit"],
  });
child("Worker", process.execPath, ["--import", "tsx", "apps/worker/index.ts"]);
child("Web server", process.execPath, [
  "node_modules/next/dist/bin/next",
  "dev",
  "apps/web",
  "-p",
  String(port),
  "--hostname",
  host,
]);
for (let attempt = 0; attempt < 60; attempt++) {
  if (await available(`http://${host}:${port}/api/v1/health/live`)) break;
  if (attempt === 59) {
    console.error("Web server did not become ready within 60 seconds.");
    stop(1);
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!stopping) console.log(`FakturaPass is ready: http://${host}:${port}`);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop(0));
process.on("exit", () => {
  children.forEach((processChild) => {
    if (processChild.exitCode == null) processChild.kill("SIGTERM");
  });
});
