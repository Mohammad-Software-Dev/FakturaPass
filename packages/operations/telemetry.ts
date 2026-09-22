import { randomUUID } from "node:crypto";
import type { DB } from "../database";
import { operationRoutes } from "./routes";
export function runtimeEnvironment() {
  const value = process.env.FAKTURAPASS_ENV ?? "LOCAL";
  if (!["LOCAL", "SANDBOX", "PILOT", "PRODUCTION"].includes(value))
    throw Error("INVALID_ENVIRONMENT");
  return value;
}
const startedAt = new Date().toISOString();
const limits = [50, 100, 250, 500, 1000, 3000];
const requests = new Map<
  string,
  {
    operation: string;
    method: string;
    statusClass: string;
    count: number;
    durationMs: number;
    buckets: number[];
  }
>();
const routes = operationRoutes.map(([method, path, operation]) => ({
  method,
  operation,
  pattern: new RegExp("^" + path.replace(/\{[^}]+\}/g, "[^/]+") + "$"),
}));
export function observeRequest(
  method: string,
  path: string[],
  status: number,
  duration: number,
) {
  const observationId = randomUUID();
  const safeMethod = ["GET", "POST", "HEAD"].includes(method)
    ? method
    : "OTHER";
  const operation =
    routes.find(
      (r) => r.method === safeMethod && r.pattern.test("/" + path.join("/")),
    )?.operation ?? "unmatched";
  const statusClass = [2, 3, 4, 5].includes(Math.floor(status / 100))
    ? `${Math.floor(status / 100)}xx`
    : "other";
  const durationMs = Number.isFinite(duration)
    ? Math.max(0, Math.round(duration))
    : 0;
  // Probe traffic is excluded from request rates, including the status endpoint itself.
  if (!["healthLive", "healthReady", "operationsStatus"].includes(operation)) {
    const key = `${operation}:${safeMethod}:${statusClass}`;
    const entry = requests.get(key) ?? {
      operation,
      method: safeMethod,
      statusClass,
      count: 0,
      durationMs: 0,
      buckets: limits.map(() => 0),
    };
    entry.count++;
    entry.durationMs += durationMs;
    limits.forEach((limit, i) => {
      if (durationMs <= limit) entry.buckets[i]++;
    });
    requests.set(key, entry);
    if (process.env.OPERATIONS_REQUEST_LOGS === "enabled")
      console.log(
        JSON.stringify({
          service: "web",
          event: "request_complete",
          observationId,
          operation,
          method: safeMethod,
          statusClass,
          durationMs,
        }),
      );
  }
  return observationId;
}
export function requestMetrics() {
  return {
    startedAt,
    scope: "serving_process",
    durationBucketUpperBoundsMs: limits,
    items: [...requests.values()].map((row) => ({
      ...row,
      buckets: [...row.buckets],
    })),
  };
}
export async function recordJobMetric(
  db: DB,
  environment: string,
  type: string,
  outcome: "PASSED" | "REJECTED" | "RETRY" | "RECOVERED",
  started: number,
) {
  await db.query(
    "INSERT INTO job_metrics(environment,job_type,outcome,attempts,duration_ms) VALUES($1,$2,$3,1,$4) ON CONFLICT(environment,job_type,outcome) DO UPDATE SET attempts=job_metrics.attempts+1,duration_ms=job_metrics.duration_ms+EXCLUDED.duration_ms",
    [
      environment,
      ["VALIDATE", "GENERATE"].includes(type) ? type : "OTHER",
      outcome,
      Math.max(0, Math.round(performance.now() - started)),
    ],
  );
}
