import { spawn } from "node:child_process";
import pg from "pg";
const run = (cmd, args = [], env = process.env) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", env });
    p.once("error", reject);
    p.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(Error(`${cmd} ${args.join(" ")} failed (${code})`)),
    );
  });
const children = [];
const databaseName = `fakturapass_verify_${process.pid}`;
const base = new URL(
  process.env.DATABASE_URL ??
    "postgres://fakturapass:local-synthetic-only@127.0.0.1:5440/fakturapass",
);
await run("docker", [
  "compose",
  "-f",
  "infra/compose.yaml",
  "up",
  "-d",
  "--wait",
]);
const admin = new pg.Pool({ connectionString: base.toString() });
await admin.query(`CREATE DATABASE "${databaseName}"`);
base.pathname = `/${databaseName}`;
const env = {
  ...process.env,
  DATABASE_URL: base.toString(),
  FAKTURAPASS_ENV: "LOCAL",
  LOCAL_BROWSER_IDENTITY: "enabled",
  PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3011",
};
async function wait(url) {
  for (let n = 0; n < 90; n++) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw Error(`Not ready: ${url}`);
}
try {
  await run(process.execPath, ["scripts/setup-engine.mjs"]);
  let engine = false;
  try {
    engine = (await fetch("http://127.0.0.1:8089/server/health")).ok;
  } catch {}
  if (!engine) {
    children.push(
      spawn(process.execPath, ["scripts/engine.mjs"], {
        stdio: ["pipe", "inherit", "inherit"],
        env,
      }),
    );
    await wait("http://127.0.0.1:8089/server/health");
  }
  for (const task of [
    "format:check",
    "typecheck",
    "lint",
    "test",
    "contracts:check",
  ])
    await run("npm", ["run", task], env);
  await run(
    process.execPath,
    ["--import", "tsx", "packages/database/migrate.ts"],
    env,
  );
  await run("npm", ["run", "test:integration"], env);
  await run("npm", ["run", "test:api"], env);
  await run("npm", ["run", "build"], env);
  children.push(
    spawn(process.execPath, ["--import", "tsx", "apps/worker/index.ts"], {
      stdio: "inherit",
      env,
    }),
  );
  children.push(
    spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "apps/web",
        "-p",
        "3011",
        "--hostname",
        "127.0.0.1",
      ],
      { stdio: "inherit", env },
    ),
  );
  await wait("http://127.0.0.1:3011/api/v1/health/ready");
  await run("npm", ["run", "test:e2e"], env);
  await run("npm", ["run", "test:recovery"], env);
  await run("npm", ["audit", "--audit-level=high"]);
  console.log(
    "Release A verification passed against an isolated temporary database and production web build.",
  );
} finally {
  for (const child of children) child.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 1000));
  await admin.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1",
    [databaseName],
  );
  await admin.query(`DROP DATABASE "${databaseName}"`);
  await admin.end();
}
