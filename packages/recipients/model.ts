import type { Invoice, Finding } from "../contracts/types";
import { sha256, stable, profiles, finding } from "../domain";
export const fields = [
  "document.buyerReference",
  "document.purchaseOrderReference",
  "document.contractReference",
  "buyer.electronicAddress.value",
  "payment.paymentReference",
];
export type Profile = {
  recipientKey: string;
  displayName: string;
  status: "UNVERIFIED" | "TENANT_VERIFIED" | "RETIRED" | "SYNTHETIC";
  identifiers: { schemeId: string; value: string }[];
  accepted: { syntaxes: string[]; profiles: string[]; channels: string[] };
  requirements: {
    id: string;
    fieldPath: string;
    predicate: "PRESENT";
    severity: "ERROR" | "WARNING";
    messageKey: string;
  }[];
  evidence: {
    sourceType: string;
    title: string;
    urlOrReference: string;
    retrievedAt: string;
    effectiveFrom: string | null;
    reviewedAt: string;
  }[];
  expiresAt: string | null;
};
export type Version = Profile & {
  required: string[];
  versionId: string;
  version: string;
  sha256: string;
  createdBy: string | null;
  createdAt: string | null;
  current: boolean;
};
export function validateProfile(p: Profile, now = Date.now()) {
  const text = (x: unknown) =>
    typeof x === "string" && !!x.trim() && x.length <= 500;
  const date = (x: unknown) =>
    typeof x === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(x) &&
    Number.isFinite(Date.parse(x));
  if (
    !p ||
    !text(p.recipientKey) ||
    !/^[a-z0-9][a-z0-9-]{0,79}$/.test(p.recipientKey) ||
    p.recipientKey.startsWith("demo-") ||
    !text(p.displayName) ||
    !["UNVERIFIED", "TENANT_VERIFIED", "RETIRED"].includes(p.status)
  )
    throw Error("INVALID_REQUEST");
  if (
    !Array.isArray(p.identifiers) ||
    !p.identifiers.length ||
    p.identifiers.length > 10 ||
    p.identifiers.some((i) => !text(i.schemeId) || !text(i.value))
  )
    throw Error("INVALID_REQUEST");
  if (
    !p.accepted ||
    ["syntaxes", "profiles", "channels"].some(
      (k) =>
        !Array.isArray((p.accepted as any)[k]) ||
        !(p.accepted as any)[k].length ||
        (p.accepted as any)[k].length > 10 ||
        (p.accepted as any)[k].some((x: unknown) => !text(x)),
    )
  )
    throw Error("INVALID_REQUEST");
  if (
    !Array.isArray(p.requirements) ||
    p.requirements.length > 30 ||
    new Set(p.requirements.map((r) => r.id)).size !== p.requirements.length ||
    p.requirements.some(
      (r) =>
        !text(r.id) ||
        !fields.includes(r.fieldPath) ||
        r.predicate !== "PRESENT" ||
        !["ERROR", "WARNING"].includes(r.severity) ||
        r.messageKey !== "RECIPIENT_REQUIREMENT_MISSING",
    )
  )
    throw Error("INVALID_REQUEST");
  if (
    !Array.isArray(p.evidence) ||
    p.evidence.length > 20 ||
    p.evidence.some(
      (e) =>
        !text(e.sourceType) ||
        !text(e.title) ||
        !text(e.urlOrReference) ||
        !date(e.retrievedAt) ||
        !date(e.reviewedAt) ||
        Date.parse(e.retrievedAt) > Date.parse(e.reviewedAt) ||
        Date.parse(e.reviewedAt) > now ||
        (e.effectiveFrom !== null && !date(e.effectiveFrom)),
    )
  )
    throw Error("INVALID_REQUEST");
  if (p.expiresAt !== null && !date(p.expiresAt))
    throw Error("INVALID_REQUEST");
  if (
    p.status === "TENANT_VERIFIED" &&
    (!p.evidence.length || !p.expiresAt || Date.parse(p.expiresAt) <= now)
  )
    throw Error("INVALID_REQUEST");
}
export function syntheticVersions(): Version[] {
  return profiles.map((p) => {
    const data: Profile = {
      recipientKey: p.recipientKey,
      displayName: p.displayName,
      status: "SYNTHETIC",
      identifiers: [],
      accepted: {
        syntaxes: ["XRECHNUNG_UBL"],
        profiles: ["XRECHNUNG"],
        channels: ["DOWNLOAD"],
      },
      requirements: p.required.map((fieldPath) => ({
        id: fieldPath,
        fieldPath,
        predicate: "PRESENT",
        severity: "ERROR",
        messageKey: "RECIPIENT_REQUIREMENT_MISSING",
      })),
      evidence: [],
      expiresAt: null,
    };
    return {
      ...data,
      required: p.required,
      versionId: p.versionId,
      version: "1",
      sha256: sha256(stable(data)),
      createdBy: null,
      createdAt: null,
      current: true,
    };
  });
}
export function coverage(
  p: Version | null,
  invoice?: Invoice,
  now = Date.now(),
): string {
  if (!p) return "UNKNOWN";
  if (p.status === "SYNTHETIC") return "SYNTHETIC";
  if (!p.current) return "SUPERSEDED";
  if (p.status === "RETIRED") return "RETIRED";
  if (p.expiresAt && Date.parse(p.expiresAt) <= now) return "EXPIRED";
  if (
    p.evidence.some((e) => e.effectiveFrom && Date.parse(e.effectiveFrom) > now)
  )
    return "NOT_YET_EFFECTIVE";
  if (p.status !== "TENANT_VERIFIED") return "UNVERIFIED";
  if (
    invoice &&
    !p.identifiers.some(
      (id) =>
        id.schemeId === invoice.buyer.electronicAddress.schemeId &&
        id.value === invoice.buyer.electronicAddress.value,
    )
  )
    return "MISMATCH";
  if (
    !p.accepted.syntaxes.includes("XRECHNUNG_UBL") ||
    !p.accepted.profiles.includes("XRECHNUNG") ||
    !p.accepted.channels.includes("DOWNLOAD")
  )
    return "UNSUPPORTED_ROUTE";
  return "VERIFIED";
}
export function checkRecipient(
  p: Version | null,
  invoice: Invoice,
  now = Date.now(),
) {
  const status = coverage(p, invoice, now);
  const fs: Finding[] = [];
  if (!["VERIFIED", "SYNTHETIC"].includes(status))
    fs.push({
      ...finding(
        "RECIPIENT_PROFILE_UNKNOWN",
        "buyer.electronicAddress.value",
        { coverage: status },
        "RECIPIENT",
        !p || status === "UNVERIFIED" ? "INFO" : "ERROR",
      ),
      evidenceSource: p?.evidence[0]?.urlOrReference ?? null,
    });
  if (p && ["VERIFIED", "SYNTHETIC", "UNVERIFIED"].includes(status))
    for (const r of p.requirements) {
      const value = r.fieldPath
        .split(".")
        .reduce((v: any, k) => v?.[k], invoice);
      if (typeof value !== "string" || !value.trim())
        fs.push({
          ...finding(
            "RECIPIENT_REQUIREMENT_MISSING",
            r.fieldPath,
            { profile: p.displayName },
            "RECIPIENT",
            r.severity,
          ),
          ruleId: `${p.versionId}:${r.id}`,
          evidenceSource:
            p.status === "SYNTHETIC"
              ? `synthetic:${p.versionId}`
              : (p.evidence[0]?.urlOrReference ?? null),
        });
    }
  return {
    versionId: p?.versionId ?? null,
    status,
    checkedAt: new Date(now).toISOString(),
    requirementsResult: fs.some((f) => f.severity === "ERROR")
      ? "FAIL"
      : status === "VERIFIED"
        ? "PASS"
        : "UNKNOWN",
    profile: p,
    findings: fs,
  };
}
