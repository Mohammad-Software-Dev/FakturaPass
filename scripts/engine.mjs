import { spawn, execFileSync } from "node:child_process";
execFileSync(process.execPath, ["scripts/setup-engine.mjs"], {
  stdio: "inherit",
});
const processHandle = spawn(
  "java",
  [
    "-Xmx768m",
    "-jar",
    "services/invoice-engine/vendor/validator.jar",
    "-s",
    "services/invoice-engine/vendor/config/scenarios.xml",
    "-r",
    "services/invoice-engine/vendor/config",
    "-D",
    "-G",
    "-H",
    "127.0.0.1",
    "-P",
    "8089",
    "-T",
    "2",
  ],
  { stdio: ["pipe", "inherit", "inherit"] },
);
for (const s of ["SIGINT", "SIGTERM"])
  process.on(s, () => processHandle.kill(s));
processHandle.on("exit", (code) => process.exit(code ?? 1));
