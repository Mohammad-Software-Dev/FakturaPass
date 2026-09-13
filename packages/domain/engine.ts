import { XMLParser } from "fast-xml-parser";
import manifest from "../../services/invoice-engine/dependencies.lock.json";
import { finding, sha256, stable } from "./index";
import type { Finding } from "../contracts/types";
export const ruleManifest = manifest;
export const ruleManifestHash = sha256(stable(manifest));
export const engineVersion = "KoSIT/1.6.3";
const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
  processEntities: false,
});
const paths: Record<string, string> = {
  "BR-DE-2": "seller.contact",
  "BR-DE-5": "seller.contact.name",
  "BR-DE-6": "seller.contact.phone",
  "BR-DE-7": "seller.contact.email",
  "BR-DE-27": "seller.contact.phone",
  "BR-DE-15": "document.buyerReference",
  "BR-CO-10": "totals.lineNetAmount",
  "BR-CO-13": "totals.taxExclusiveAmount",
  "BR-CO-14": "totals.taxAmount",
  "BR-CO-15": "totals.taxInclusiveAmount",
  "BR-CO-16": "totals.payableAmount",
};
function pathFor(rule: string, xmlPath: string) {
  if (paths[rule]) return paths[rule];
  const prefix = xmlPath.includes("AccountingSupplierParty")
    ? "seller"
    : xmlPath.includes("AccountingCustomerParty")
      ? "buyer"
      : null;
  if (prefix) {
    if (xmlPath.includes("EndpointID")) return `${prefix}.electronicAddress`;
    if (xmlPath.includes("PostalAddress")) return `${prefix}.address`;
    return prefix;
  }
  const line = xmlPath.match(/InvoiceLine\[(\d+)\]/);
  if (line) return `lines.${Number(line[1]) - 1}`;
  if (xmlPath.includes("PaymentMeans")) return "payment";
  if (xmlPath.includes("TaxSubtotal")) return "taxBreakdown";
  return "";
}
export async function officialValidate(xml: string): Promise<{
  pass: boolean;
  findings: Finding[];
  rawReport: string;
  scenario: string;
}> {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw Error("GENERATION_FAILED");
  const response = await fetch(
    `${process.env.INVOICE_ENGINE_URL ?? "http://127.0.0.1:8089"}/invoice.xml`,
    {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: xml,
      signal: AbortSignal.timeout(60000),
    },
  );
  if (![200, 406].includes(response.status)) throw Error("ENGINE_UNAVAILABLE");
  const rawReport = await response.text();
  const doc = parser.parse(rawReport);
  const findings: Finding[] = [];
  const seen = new Set<string>();
  const scenario = doc.report?.scenarioMatched?.scenario?.name ?? "";
  const reportedHash = doc.report?.documentIdentification?.documentHash;
  if (
    doc.report?.engine?.name !== "KoSIT Validator 1.6.3" ||
    reportedHash?.hashAlgorithm !== "SHA-256" ||
    Buffer.from(reportedHash?.hashValue ?? "", "base64").toString("hex") !==
      sha256(xml)
  ) {
    throw Error("ARTIFACT_HASH_MISMATCH");
  }
  function walk(v: any) {
    if (!v || typeof v !== "object") return;
    for (const [k, value] of Object.entries(v)) {
      if (k === "message") {
        for (const a of Array.isArray(value) ? value : [value]) {
          if (typeof a !== "object" || !a["@_level"]) continue;
          const id = a["@_code"] ?? a["@_id"] ?? "XRECHNUNG";
          const message = String(a["#text"] ?? id).trim();
          const severity: Finding["severity"] =
            a["@_level"] === "warning"
              ? "WARNING"
              : a["@_level"] === "information"
                ? "INFO"
                : "ERROR";
          const xmlPath = a["@_xpathLocation"] ?? "";
          const key = stable([id, xmlPath, message]);
          if (seen.has(key)) continue;
          seen.add(key);
          findings.push({
            ...finding(
              "VALIDATION_FAILED",
              pathFor(id, xmlPath),
              { message, xmlPath },
              "STANDARD",
              severity,
            ),
            ruleId: id,
            evidenceSource: "KoSIT 1.6.3 / XRechnung 2026-01-31",
          });
        }
      }
      if (k !== "assessment") walk(value);
    }
  }
  walk(doc.report?.scenarioMatched);
  const pass =
    response.status === 200 &&
    scenario === "EN16931 XRechnung (UBL Invoice)" &&
    !findings.some((f) => f.severity === "ERROR");
  if (!pass && !findings.some((f) => f.severity === "ERROR"))
    findings.push(
      finding(
        "VALIDATION_FAILED",
        "",
        {
          reason:
            "Offizielle Prüfung oder erwartetes XRechnung-Szenario nicht bestanden",
        },
        "STANDARD",
      ),
    );
  return { pass, findings, rawReport, scenario };
}
