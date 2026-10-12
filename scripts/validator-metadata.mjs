import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";

// Only supplement known, byte-verified artifacts; never mutate the raw scanner output.
export function enrichValidatorInventory(
  raw,
  lock,
  verifiedFiles,
  readEvidence,
) {
  if (
    lock?.schemaVersion !== "fakturapass.validator-metadata.v1" ||
    !Array.isArray(lock.records) ||
    !lock.records.length
  )
    throw Error("Invalid validator metadata lock");
  const inventory = structuredClone(raw);
  const changes = [];
  const seen = new Set();
  for (const r of lock.records) {
    if (
      seen.has(r.path) ||
      !/^[a-zA-Z0-9_.-]+\.pom$/.test(r.pom) ||
      !/^[a-f0-9]{64}$/.test(r.sha256) ||
      verifiedFiles[r.path] !== r.sha256
    )
      throw Error("Unverified or duplicate metadata target");
    if (
      !["", "data"].includes(r.classifier) ||
      r.path !==
        `/engine/distribution/libs/${r.artifactId}-${r.version}${r.classifier ? `-${r.classifier}` : ""}.jar`
    )
      throw Error("Metadata classifier or path mismatch");
    seen.add(r.path);
    const bytes = readEvidence(r.pom);
    if (createHash("sha256").update(bytes).digest("hex") !== r.pomSha256)
      throw Error("Upstream POM checksum mismatch");
    const p = new XMLParser().parse(bytes.toString()).project;
    const licenses = Array.isArray(p.licenses?.license)
      ? p.licenses.license
      : [p.licenses?.license];
    const expressions = {
      "http://www.mozilla.org/MPL/2.0/": "MPL-2.0",
      "http://www.apache.org/licenses/LICENSE-2.0.txt": "Apache-2.0",
      "https://www.apache.org/licenses/LICENSE-2.0": "Apache-2.0",
    };
    if (
      p.groupId !== r.groupId ||
      p.artifactId !== r.artifactId ||
      String(p.version) !== r.version ||
      licenses.length !== 1 ||
      licenses[0]?.url !== r.licenseUrl ||
      expressions[r.licenseUrl] !== r.licenseExpression
    )
      throw Error("Metadata differs from upstream POM declarations");
    const matches = inventory.artifacts.filter(
      (a) =>
        a.type === "java-archive" &&
        a.locations?.some((l) => l.path === r.path),
    );
    if (matches.length !== 1)
      throw Error("Missing or ambiguous metadata target in inventory");
    const a = matches[0];
    if (
      a.name !== r.artifactId ||
      ![r.version, `${r.version}-${r.classifier}`].includes(a.version)
    )
      throw Error("Unexpected scanned package identity");
    // Refuse to replace a conflicting declaration rather than hiding it.
    if (
      a.licenses?.some(
        (l) => (l.spdxExpression || l.value) !== r.licenseExpression,
      )
    )
      throw Error("Conflicting installed license declaration");
    const before = {
      version: a.version,
      purl: a.purl,
      licenses: a.licenses,
      cpes: a.cpes,
    };
    a.version = r.version;
    a.purl = `pkg:maven/${r.groupId}/${r.artifactId}@${r.version}${r.classifier ? `?classifier=${r.classifier}` : ""}`;
    a.cpes = (a.cpes ?? []).map((c) => {
      const fields = c.cpe.split(":");
      if (fields[5] === before.version) fields[5] = r.version;
      return { ...c, cpe: fields.join(":") };
    });
    a.licenses = [
      {
        value: r.licenseExpression,
        spdxExpression: r.licenseExpression,
        type: "declared",
        urls: [r.licenseUrl],
        locations: a.locations,
      },
    ];
    changes.push({
      path: r.path,
      sha256: r.sha256,
      sourceUrl: r.sourceUrl,
      pomSha256: r.pomSha256,
      before,
      after: {
        version: a.version,
        purl: a.purl,
        licenses: a.licenses,
        cpes: a.cpes,
      },
    });
  }
  return { inventory, changes };
}
