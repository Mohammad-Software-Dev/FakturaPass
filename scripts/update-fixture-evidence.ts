import { readFileSync, writeFileSync } from "node:fs";
import {
  officialValidate,
  ruleManifest,
  ruleManifestHash,
  engineVersion,
} from "../packages/domain/engine";
import {
  semanticFindings,
  sha256,
  stable,
  GENERATOR_VERSION,
} from "../packages/domain";
import { generateUbl } from "../packages/domain/ubl";
for (const id of ["FP-A-001", "FP-A-003"]) {
  const raw = readFileSync(`fixtures/valid/${id}.json`),
    canonical = JSON.parse(raw.toString()),
    xml = generateUbl(canonical);
  const result = await officialValidate(xml);
  if (!result.pass) throw Error(JSON.stringify(result.findings));
  if (xml !== readFileSync(`fixtures/expected-output/${id}.xml`, "utf8"))
    throw Error("Golden XML changed; explicit generator review required");
  writeFileSync(
    `fixtures/expected-output/${id}.findings.json`,
    JSON.stringify(result.findings, null, 2) + "\n",
  );
  writeFileSync(
    `fixtures/expected-output/${id}.semantic.json`,
    JSON.stringify(semanticFindings(canonical), null, 2) + "\n",
  );
  writeFileSync(`fixtures/expected-output/${id}.report.xml`, result.rawReport);
  writeFileSync(
    `fixtures/expected-output/${id}.evidence.json`,
    JSON.stringify(
      {
        fixtureId: id,
        sourceSha256: sha256(raw),
        canonicalSha256: sha256(stable(canonical)),
        xmlSha256: sha256(xml),
        reportSha256: sha256(result.rawReport),
        engineVersion,
        generatorVersion: GENERATOR_VERSION,
        ruleManifestHash,
        ruleManifest,
        scenario: result.scenario,
        findings: result.findings,
      },
      null,
      2,
    ) + "\n",
  );
}
