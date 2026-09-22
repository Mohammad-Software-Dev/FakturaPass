import { spawn } from "node:child_process";
const commands = {
  web: [
    "node_modules/next/dist/bin/next",
    "start",
    "apps/web",
    "-p",
    "3010",
    "--hostname",
    "0.0.0.0",
  ],
  worker: ["runtime/worker.mjs"],
  migrate: ["runtime/migrate.mjs"],
  operations: ["runtime/operations.mjs"],
  "identity-provision": ["runtime/identity-provision.mjs"],
  "organization-bootstrap": ["runtime/organization-bootstrap.mjs"],
  "support-agent": ["runtime/support-agent.mjs"],
  "mapping-register": ["runtime/mapping-register.mjs"],
};
const command = process.argv[2];
if (
  !Object.hasOwn(commands, command) ||
  !process.env.DATABASE_URL ||
  !["LOCAL", "SANDBOX", "PILOT", "PRODUCTION"].includes(
    process.env.FAKTURAPASS_ENV,
  ) ||
  (["web", "worker", "operations"].includes(command) &&
    !process.env.INVOICE_ENGINE_URL) ||
  (process.env.FAKTURAPASS_ENV !== "LOCAL" &&
    (process.env.AUTH_MODE !== "oidc" ||
      process.env.LOCAL_BROWSER_IDENTITY === "enabled")) ||
  (command === "web" &&
    process.env.AUTH_MODE === "oidc" &&
    ["APP_ORIGIN", "OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET"].some(
      (key) => !process.env[key],
    ))
) {
  console.error(
    JSON.stringify({
      service: "container",
      code: "INVALID_RUNTIME_CONFIGURATION",
    }),
  );
  process.exit(1);
}
const child = spawn(
  process.execPath,
  [...commands[command], ...process.argv.slice(3)],
  { stdio: "inherit" },
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("error", () => {
  console.error(
    JSON.stringify({ service: "container", code: "PROCESS_START_FAILED" }),
  );
  process.exit(1);
});
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
