export const reasons = [
  "TECHNICAL_RETRY",
  "DATA_ERRORS",
  "UNSUPPORTED_CASE",
  "RECIPIENT_REVIEW",
  "VALIDATION_REQUIRED",
  "APPROVAL_REQUIRED",
  "GENERATION_REQUIRED",
] as const;
export function reviewReasons(
  status: string,
  validationStatus: string | null,
  recipientCoverage: string,
) {
  const result: string[] = [];
  if (validationStatus === "ERROR") result.push("TECHNICAL_RETRY");
  if (status === "INVALID") result.push("DATA_ERRORS");
  if (status === "BLOCKED_UNSUPPORTED") result.push("UNSUPPORTED_CASE");
  const stale = [
    "EXPIRED",
    "SUPERSEDED",
    "RETIRED",
    "NOT_YET_EFFECTIVE",
    "MISMATCH",
    "UNSUPPORTED_ROUTE",
  ].includes(recipientCoverage);
  if (
    stale ||
    (validationStatus &&
      !["PENDING", "ERROR"].includes(validationStatus) &&
      status !== "ARTIFACT_VALIDATED" &&
      ["UNKNOWN", "UNVERIFIED", "SYNTHETIC"].includes(recipientCoverage))
  )
    result.push("RECIPIENT_REVIEW");
  if (status === "NORMALIZED") result.push("VALIDATION_REQUIRED");
  if (status === "VALID") result.push("APPROVAL_REQUIRED");
  if (status === "APPROVED") result.push("GENERATION_REQUIRED");
  return result;
}
