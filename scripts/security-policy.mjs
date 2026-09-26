function validatePolicy(policy) {
  if (
    policy?.schemaVersion !== "fakturapass.security-policy.v1" ||
    !Array.isArray(policy.blockedSeverities) ||
    !["High", "Critical", "Unknown"].every((s) =>
      policy.blockedSeverities.includes(s),
    ) ||
    !Number.isFinite(policy.maxDatabaseAgeHours) ||
    policy.maxDatabaseAgeHours <= 0 ||
    !Array.isArray(policy.allowedDependencyLicenseExpressions) ||
    !policy.allowedDependencyLicenseExpressions.length ||
    !policy.allowedDependencyLicenseExpressions.every(
      (s) => typeof s === "string" && s.length > 0,
    ) ||
    !Array.isArray(policy.exceptions)
  )
    throw Error("Invalid security policy");
}

export function validateScanTarget(imageId, target) {
  if (
    !/^sha256:[a-f0-9]{64}$/.test(imageId) ||
    !/^[a-z][a-z0-9-]*$/.test(target)
  )
    throw Error("Scan requires an immutable image ID and safe target name");
}
// Exact declarations only: unfamiliar expressions require review instead of guessing
// whether AND/OR branches, custom identifiers or exceptions are acceptable.
export function evaluateLicenses(bom, policy) {
  validatePolicy(policy);
  if (
    bom?.bomFormat !== "CycloneDX" ||
    !Array.isArray(bom.components) ||
    !bom.components.length
  )
    throw Error("Invalid or empty dependency SBOM");
  const findings = [];
  for (const component of bom.components) {
    if (!component.name || !component.version)
      throw Error("Unidentified dependency");
    const declarations = (component.licenses ?? []).map(
      (item) => item.expression ?? item.license?.id ?? item.license?.name,
    );
    if (
      !declarations.length ||
      declarations.some(
        (value) => !policy.allowedDependencyLicenseExpressions.includes(value),
      )
    )
      findings.push({
        name: component.name,
        version: component.version,
        licenses: declarations,
        status: "REVIEW_REQUIRED",
      });
  }
  return {
    status: findings.length ? "blocked" : "passed",
    scope:
      "npm dependencies; OS/third-party notice obligations require separate review",
    components: bom.components.length,
    findings,
  };
}
export function evaluateVulnerabilities(report, policy, now = new Date()) {
  validatePolicy(policy);
  if (
    !Array.isArray(report?.matches) ||
    !report.descriptor?.version ||
    !report.source
  )
    throw Error("Invalid vulnerability report");
  const database = report.descriptor.db?.status;
  const built = Date.parse(database?.built);
  const age = now.getTime() - built;
  if (
    database?.valid !== true ||
    !Number.isFinite(age) ||
    age < -300000 ||
    age > policy.maxDatabaseAgeHours * 3600000
  )
    throw Error("Missing, invalid or stale vulnerability database");
  // No silent suppression or permanent blanket exclusions are accepted.
  if (report.ignoredMatches?.length) throw Error("Scanner suppressed findings");
  const exceptions = policy.exceptions ?? [];
  for (const entry of exceptions) {
    if (
      !entry.id ||
      !entry.package ||
      !entry.purl ||
      !entry.version ||
      !entry.reason ||
      !entry.owner ||
      !entry.reference ||
      !entry.expiresAt ||
      !Number.isFinite(Date.parse(entry.expiresAt)) ||
      Date.parse(entry.expiresAt) <= now.getTime()
    )
      throw Error("Invalid or expired security exception");
  }
  const findings = report.matches.map((match) => {
    const vulnerability = match.vulnerability;
    const artifact = match.artifact;
    if (!vulnerability?.id || !artifact?.name || !artifact.version)
      throw Error("Unidentified vulnerability finding");
    const severity = vulnerability.severity ?? "Unknown";
    const blocked =
      !["Negligible", "Low", "Medium", "High", "Critical"].includes(severity) ||
      policy.blockedSeverities.includes(severity);
    const exception = exceptions.find(
      (entry) =>
        entry.id === vulnerability.id &&
        entry.package === artifact.name &&
        entry.purl === artifact.purl &&
        entry.version === artifact.version,
    );
    return {
      id: vulnerability.id,
      package: artifact.name,
      purl: artifact.purl,
      version: artifact.version,
      severity,
      fix: vulnerability.fix,
      status: blocked ? (exception ? "excepted" : "blocked") : "recorded",
      ...(exception ? { exception } : {}),
    };
  });
  return {
    status: findings.some((f) => f.status === "blocked") ? "blocked" : "passed",
    database: { built: database.built, schemaVersion: database.schemaVersion },
    findings,
  };
}
