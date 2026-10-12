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

// Use filesystem evidence: npm's dependency graph can retain omitted transitive packages.
function applicationPackageType(profile) {
  if (profile === "npm") return "npm";
  if (profile === "validator") return "java-archive";
  throw Error("Unsupported image inventory profile");
}

export function evaluateImageLicenses(sbom, policy, profile = "npm") {
  const packageType = applicationPackageType(profile);
  if (sbom?.source?.type !== "image" || !Array.isArray(sbom.artifacts))
    throw Error("Invalid image license inventory");
  const packages = sbom.artifacts.filter((a) => a.type === packageType);
  const firstParty = (a) =>
    profile === "npm" &&
    a.name === "fakturapass" &&
    a.locations?.length === 1 &&
    a.locations[0].path === "/app/package.json";
  const result = evaluateLicenses(
    {
      bomFormat: "CycloneDX",
      components: packages
        .filter((a) => !firstParty(a))
        .map((a) => ({
          name: a.name,
          version: a.version,
          licenses: (a.licenses ?? []).map((l) => ({
            expression: l.spdxExpression || l.value,
          })),
        })),
    },
    policy,
  );
  return {
    ...result,
    scope:
      profile === "validator"
        ? "Installed Java archives, including shaded dependencies; OS/JRE and rule-configuration notices require separate review"
        : "Installed third-party npm packages, including bundled packages; OS/native notice obligations require separate review",
    firstParty: packages.filter(firstParty).map((a) => ({
      name: a.name,
      version: a.version,
      path: a.locations[0].path,
    })),
  };
}

export function validateImageInventory(sbom, profile = "npm") {
  const applicationType = applicationPackageType(profile);
  const packageType = { debian: "deb", ubuntu: "deb", alpine: "apk" }[
    sbom?.distro?.id
  ];
  if (
    !packageType ||
    sbom?.source?.type !== "image" ||
    !Array.isArray(sbom.artifacts) ||
    !sbom.artifacts.some((a) => a.type === packageType) ||
    !sbom.artifacts.some((a) => a.type === applicationType)
  )
    throw Error(
      `Incomplete image inventory: expected supported OS and ${applicationType} packages`,
    );
  if (
    profile === "validator" &&
    !sbom.artifacts.some(
      (a) =>
        a.type === "java-archive" &&
        a.name === "validator" &&
        a.locations?.some((l) => l.path === "/engine/validator.jar"),
    )
  )
    throw Error("Missing executable validator JAR inventory");
  return packageType;
}

// Compare the scanned shaded JAR with independently retained build declarations.
export function evaluateValidatorCoverage(sbom, expected) {
  validateImageInventory(sbom, "validator");
  if (!Array.isArray(expected) || !expected.length)
    throw Error("Missing validator dependency coverage expectations");
  const packages = sbom.artifacts.filter(
    (a) =>
      a.type === "java-archive" &&
      a.locations?.some((l) => l.path === "/engine/validator.jar"),
  );
  const findings = expected.flatMap((e) => {
    if (!e.name || !e.evidence)
      throw Error("Unidentified coverage expectation");
    const found = packages.find(
      (a) => a.name.toLowerCase() === e.name.toLowerCase(),
    );
    if (!found) return [{ ...e, status: "MISSING_FROM_INVENTORY" }];
    if (
      !found.version ||
      found.version === "UNKNOWN" ||
      (e.version && e.version !== found.version)
    )
      return [
        {
          ...e,
          actualVersion: found.version,
          status: "VERSION_REVIEW_REQUIRED",
        },
      ];
    return [];
  });
  return {
    status: findings.length ? "blocked" : "passed",
    expected,
    findings,
    scope:
      "Declared non-test dependencies and known shaded class markers; not proof of exhaustive transitive coverage",
  };
}
