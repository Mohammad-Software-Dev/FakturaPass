import pg from "pg";
import { createHash, timingSafeEqual } from "node:crypto";
import { requestMetrics, runtimeEnvironment } from "./telemetry";
export const operationsPool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgres://fakturapass:local-synthetic-only@127.0.0.1:5440/fakturapass",
  max: 1,
  connectionTimeoutMillis: 2500,
  query_timeout: 2500,
  statement_timeout: 2000,
  idleTimeoutMillis: 5000,
});
operationsPool.on("error", () =>
  console.error(
    JSON.stringify({ service: "operations", code: "DATABASE_UNAVAILABLE" }),
  ),
);
export function operationsAuthorization(request: Request): number {
  const token = process.env.OPERATIONS_TOKEN;
  if (!token || !/^[A-Za-z0-9_-]{43,128}$/.test(token)) return 404;
  const supplied = request.headers.get("X-Operations-Token") ?? "";
  if (
    supplied.length > 128 ||
    request.headers.has("authorization") ||
    request.headers.has("X-API-Key")
  )
    return 401;
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(token), digest(supplied)) ? 200 : 401;
}
export async function operationalStatus() {
  const environment = runtimeEnvironment();
  const threshold = Number(process.env.OPERATIONS_QUEUE_WARNING_SECONDS ?? 300);
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 86400)
    throw Error("INVALID_OPERATIONS_CONFIGURATION");
  const [database, engine] = await Promise.allSettled([
    operationsPool.query(
      `SELECT
   (SELECT json_build_object('pending',count(*) FILTER(WHERE state='PENDING'),'running',count(*) FILTER(WHERE state='RUNNING'),'due',count(*) FILTER(WHERE state='PENDING' AND available_at<=now()),'retrying',count(*) FILTER(WHERE state='PENDING' AND last_error_code IS NOT NULL),'expiredLeases',count(*) FILTER(WHERE state='RUNNING' AND lease_until<now()),'oldestRetrySeconds',COALESCE(max(EXTRACT(EPOCH FROM now()-created_at)) FILTER(WHERE state='PENDING' AND last_error_code IS NOT NULL),0),'oldestDueSeconds',COALESCE(max(EXTRACT(EPOCH FROM now()-created_at)) FILTER(WHERE state='PENDING' AND available_at<=now()),0)) FROM jobs WHERE environment=$1) AS queue,
   (SELECT json_build_object('active',count(*) FILTER(WHERE last_seen_at>now()-interval '45 seconds'),'lastSeenSeconds',EXTRACT(EPOCH FROM now()-max(last_seen_at))) FROM worker_heartbeats WHERE environment=$1) AS workers,
   (SELECT COALESCE(json_agg(json_build_object('type',job_type,'outcome',outcome,'attempts',attempts,'durationMs',duration_ms)),'[]') FROM job_metrics WHERE environment=$1) AS jobs`,
      [environment],
    ),
    fetch(
      `${process.env.INVOICE_ENGINE_URL ?? "http://127.0.0.1:8089"}/server/health`,
      { signal: AbortSignal.timeout(2500) },
    ).then((r) => {
      if (!r.ok) throw Error();
      return true;
    }),
  ]);
  const data = database.status === "fulfilled" ? database.value.rows[0] : null;
  const alerts: string[] = [];
  if (!data) alerts.push("DATABASE_UNAVAILABLE");
  if (engine.status !== "fulfilled") alerts.push("ENGINE_UNAVAILABLE");
  if (data) {
    if (!data.workers.active) alerts.push("WORKER_MISSING");
    if (data.queue.expiredLeases > 0) alerts.push("JOB_LEASE_EXPIRED");
    if (data.queue.oldestDueSeconds > threshold) alerts.push("QUEUE_DELAYED");
    if (data.queue.oldestRetrySeconds > threshold)
      alerts.push("JOB_RETRY_DELAYED");
  }
  return {
    schemaVersion: "fakturapass.operations.v1",
    environment,
    observedAt: new Date().toISOString(),
    status: alerts.length ? "degraded" : "healthy",
    alerts,
    components: {
      database: data ? "up" : "down",
      engine: engine.status === "fulfilled" ? "up" : "down",
    },
    queue: data?.queue ?? null,
    workers: data?.workers ?? null,
    jobs: data?.jobs ?? null,
    requests: requestMetrics(),
    thresholds: { workerStaleSeconds: 45, queueWarningSeconds: threshold },
  };
}
