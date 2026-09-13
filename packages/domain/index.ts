import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import type { Invoice, Finding } from "../contracts/types";
Decimal.set({ precision: 160, rounding: Decimal.ROUND_HALF_UP });
export { Decimal };
export const GENERATOR_VERSION = "fakturapass-ubl/1.0.0";
export const stable = (value: unknown): string => JSON.stringify(sort(value));
function sort(v: any): any {
  if (Array.isArray(v)) return v.map(sort);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, sort(v[k])]),
    );
  return v;
}
export const sha256 = (s: string | Buffer) =>
  createHash("sha256").update(s).digest("hex");
export { schemaFindings } from "../contracts/validate";
export function finding(
  code: string,
  path: string,
  parameters: Record<string, unknown> = {},
  layer: Finding["layer"] = "SEMANTIC",
  severity: Finding["severity"] = "ERROR",
): Finding {
  return {
    code,
    severity,
    layer,
    canonicalPath: path,
    sourcePath: path ? `$.${path}` : null,
    ruleId: null,
    messageKey: code,
    parameters,
    evidenceSource: null,
  };
}
export const profiles = [
  {
    recipientKey: "demo-reference",
    versionId: "synthetic-reference-v1",
    displayName: "Demo · Käuferreferenz",
    status: "SYNTHETIC",
    required: ["document.buyerReference"],
  },
  {
    recipientKey: "demo-purchase-order",
    versionId: "synthetic-po-v1",
    displayName: "Demo · Bestellbezug",
    status: "SYNTHETIC",
    required: ["document.buyerReference", "document.purchaseOrderReference"],
  },
  {
    recipientKey: "demo-contract",
    versionId: "synthetic-contract-v1",
    displayName: "Demo · Vertragsbezug",
    status: "SYNTHETIC",
    required: ["document.buyerReference", "document.contractReference"],
  },
];
export function semanticFindings(
  i: Invoice,
  profileId: string | null = null,
): Finding[] {
  const fs: Finding[] = [];
  const d = (v: string) => new Decimal(v);
  const r = (v: Decimal) => v.toDecimalPlaces(2);
  const sum = (vs: string[]) => vs.reduce((a, b) => a.plus(b), d("0"));
  const unsupported = (path: string, reason: string) =>
    fs.push(finding("UNSUPPORTED_CASE", path, { reason }));
  if (i.document.currency !== "EUR" || i.document.type !== "INVOICE")
    unsupported("document", "Nur deutsche EUR-Rechnungen werden unterstützt.");
  if (
    i.seller.address.countryCode !== "DE" ||
    i.buyer.address.countryCode !== "DE"
  )
    unsupported("buyer.address.countryCode", "Nur Inland Deutschland.");
  if (i.attachments.length)
    unsupported("attachments", "Anhänge sind noch nicht freigegeben.");
  for (const [j, l] of i.lines.entries()) {
    if (l.tax.categoryCode !== "S" || !d(l.tax.rate).eq(19))
      unsupported(
        `lines.${j}.tax`,
        "Release A unterstützt ausschließlich explizit angegebene 19 % Standard-Umsatzsteuer.",
      );
  }
  for (const [j, t] of i.taxBreakdown.entries())
    if (t.categoryCode !== "S" || !d(t.rate).eq(19))
      unsupported(`taxBreakdown.${j}`, "Steuerfall nicht freigegeben.");
  const match = (
    path: string,
    declared: string,
    computed: Decimal,
    code = "TOTAL_MISMATCH",
  ) => {
    if (!d(declared).eq(computed))
      fs.push(finding(code, path, { declared, computed: computed.toFixed(2) }));
  };
  const acCheck = (a: Invoice["allowancesCharges"][number], p: string) => {
    if (a.baseAmount != null && a.percentage != null)
      match(
        `${p}.amount`,
        a.amount,
        r(d(a.baseAmount).mul(a.percentage).div(100)),
      );
    if (!a.reason && !a.reasonCode)
      fs.push(finding("REQUIRED_FIELD_MISSING", `${p}.reason`));
  };
  const ids = new Set<string>();
  i.lines.forEach((l, j) => {
    const p = `lines.${j}`;
    if (ids.has(l.id))
      fs.push(
        finding("INVALID_REQUEST", `${p}.id`, {
          reason: "Positionsnummer doppelt",
        }),
      );
    ids.add(l.id);
    if (d(l.unitPrice.baseQuantity).lte(0)) {
      fs.push(
        finding("DECIMAL_INVALID", `${p}.unitPrice.baseQuantity`, {
          reason: "Muss größer als null sein",
        }),
      );
      return;
    }
    if (d(l.quantity).lte(0))
      fs.push(
        finding("DECIMAL_INVALID", `${p}.quantity`, {
          reason: "Muss größer als null sein",
        }),
      );
    l.allowancesCharges.forEach((a, k) =>
      acCheck(a, `${p}.allowancesCharges.${k}`),
    );
    const extra = l.allowancesCharges.reduce(
      (v, a) => (a.charge ? v.plus(a.amount) : v.minus(a.amount)),
      d("0"),
    );
    match(
      `${p}.lineNetAmount`,
      l.lineNetAmount,
      r(
        d(l.quantity)
          .mul(l.unitPrice.amount)
          .div(l.unitPrice.baseQuantity)
          .plus(extra),
      ),
    );
  });
  i.allowancesCharges.forEach((a, j) => {
    acCheck(a, `allowancesCharges.${j}`);
    if (!a.tax)
      fs.push(finding("REQUIRED_FIELD_MISSING", `allowancesCharges.${j}.tax`));
    else if (a.tax.categoryCode !== "S" || !d(a.tax.rate).eq(19))
      unsupported(
        `allowancesCharges.${j}.tax`,
        "Steuerfall nicht freigegeben.",
      );
  });
  const line = sum(i.lines.map((l) => l.lineNetAmount));
  const allowance = sum(
    i.allowancesCharges.filter((a) => !a.charge).map((a) => a.amount),
  );
  const charge = sum(
    i.allowancesCharges.filter((a) => a.charge).map((a) => a.amount),
  );
  const exclusive = line.minus(allowance).plus(charge);
  const groups = new Map<string, Decimal>();
  const group = (t: { categoryCode: string; rate: string }) =>
    `${t.categoryCode}/${d(t.rate).toString()}`;
  i.lines.forEach((l) =>
    groups.set(
      group(l.tax),
      (groups.get(group(l.tax)) ?? d("0")).plus(l.lineNetAmount),
    ),
  );
  i.allowancesCharges.forEach((a) => {
    if (a.tax)
      groups.set(
        group(a.tax),
        (groups.get(group(a.tax)) ?? d("0")).plus(
          d(a.amount).mul(a.charge ? 1 : -1),
        ),
      );
  });
  const seen = new Set<string>();
  i.taxBreakdown.forEach((t, j) => {
    const k = group(t);
    if (seen.has(k))
      fs.push(
        finding("TAX_BREAKDOWN_MISMATCH", `taxBreakdown.${j}`, {
          reason: "Doppelte Steuergruppe",
        }),
      );
    seen.add(k);
    const taxable = groups.get(k) ?? d("0");
    match(
      `taxBreakdown.${j}.taxableAmount`,
      t.taxableAmount,
      taxable,
      "TAX_BREAKDOWN_MISMATCH",
    );
    match(
      `taxBreakdown.${j}.taxAmount`,
      t.taxAmount,
      r(taxable.mul(t.rate).div(100)),
      "TAX_BREAKDOWN_MISMATCH",
    );
  });
  for (const k of groups.keys())
    if (!seen.has(k))
      fs.push(
        finding("TAX_BREAKDOWN_MISMATCH", "taxBreakdown", { missingGroup: k }),
      );
  const tax = sum(i.taxBreakdown.map((t) => t.taxAmount));
  const inclusive = exclusive.plus(tax);
  const payable = inclusive
    .minus(i.totals.prepaidAmount)
    .plus(i.totals.payableRoundingAmount);
  for (const [k, v] of Object.entries({
    lineNetAmount: line,
    allowanceTotal: allowance,
    chargeTotal: charge,
    taxExclusiveAmount: exclusive,
    taxAmount: tax,
    taxInclusiveAmount: inclusive,
    payableAmount: payable,
  }))
    match(`totals.${k}`, i.totals[k as keyof Invoice["totals"]], v);
  const profile = profiles.find((p) => p.versionId === profileId);
  if (!profile)
    fs.push(finding("RECIPIENT_PROFILE_UNKNOWN", "", {}, "RECIPIENT", "INFO"));
  else
    for (const path of profile.required)
      if (!(i.document as any)[path.split(".")[1]])
        fs.push({
          ...finding(
            "RECIPIENT_REQUIREMENT_MISSING",
            path,
            { profile: profile.displayName },
            "RECIPIENT",
          ),
          evidenceSource: `synthetic:${profile.versionId}`,
          ruleId: `${profile.versionId}:${path}`,
        });
  return fs;
}
