import { processJob } from "../../packages/domain/service";
import { pool } from "../../packages/database";
let stopped = false;
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
await pool.end();
