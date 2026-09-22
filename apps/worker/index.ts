import { randomUUID } from "node:crypto";
import { runtimeEnvironment } from "../../packages/operations/telemetry";
import { operationsPool } from "../../packages/operations/status";
import { processJob } from "../../packages/domain/service";
import { pool } from "../../packages/database";
const workerId = randomUUID(),
  environment = runtimeEnvironment();
let stopped = false;
let beating = false;
async function heartbeat() {
  if (beating) return;
  beating = true;
  try {
    await operationsPool.query(
      "INSERT INTO worker_heartbeats(id,environment) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET last_seen_at=now()",
      [workerId, environment],
    );
    await operationsPool.query(
      "DELETE FROM worker_heartbeats WHERE last_seen_at<now()-interval '1 day'",
    );
  } catch {
    console.error(
      JSON.stringify({ service: "worker", code: "HEARTBEAT_UNAVAILABLE" }),
    );
  } finally {
    beating = false;
  }
}
await heartbeat();
const timer = setInterval(() => void heartbeat(), 10000);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopped = true;
  });
console.log(JSON.stringify({ service: "worker", status: "started" }));
while (!stopped) {
  try {
    if (!(await processJob())) await new Promise((r) => setTimeout(r, 500));
  } catch {
    console.error(
      JSON.stringify({ service: "worker", code: "INTERNAL_ERROR" }),
    );
    await new Promise((r) => setTimeout(r, 2000));
  }
}
clearInterval(timer);
while (beating) await new Promise((r) => setTimeout(r, 20));
try {
  await operationsPool.query("DELETE FROM worker_heartbeats WHERE id=$1", [
    workerId,
  ]);
} catch {}
await operationsPool.end();
await pool.end();
