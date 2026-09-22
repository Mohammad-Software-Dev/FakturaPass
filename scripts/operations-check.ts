import {
  operationalStatus,
  operationsPool,
} from "../packages/operations/status";
try {
  const report = await operationalStatus();
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "healthy") process.exitCode = 1;
} catch {
  console.error(
    JSON.stringify({
      status: "unavailable",
      code: "OPERATIONS_CONFIGURATION_ERROR",
    }),
  );
  process.exitCode = 1;
} finally {
  await operationsPool.end();
}
