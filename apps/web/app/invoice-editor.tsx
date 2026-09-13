"use client";
import { recalculateInvoice } from "../../../packages/domain/recalculate";
import { schemaFindings } from "../../../packages/contracts/validate";
import { findingDescription } from "../../../packages/i18n";
import { useState } from "react";
import type { Invoice } from "../../../packages/contracts/types";
import { useLanguage } from "./language";

export const editorLabels: Record<string, string> = {
  number: "Rechnungsnummer",
  issueDate: "Rechnungsdatum",
  buyerReference: "Käuferreferenz",
  purchaseOrderReference: "Bestellnummer",
  contractReference: "Vertragsreferenz",
  name: "Name",
  description: "Beschreibung",
  street: "Straße",
  additional: "Adresszusatz",
  postalCode: "Postleitzahl",
  city: "Ort",
  vatId: "USt-ID:",
  taxNumber: "Steuernummer",
  email: "E-Mail",
  phone: "Telefon",
  quantity: "Menge",
  unitCode: "Einheit",
  amount: "Betrag",
  baseQuantity: "Preisbasis",
  lineNetAmount: "Positionssumme",
  dueDate: "Fällig am",
  terms: "Zahlungsbedingungen",
  iban: "IBAN",
  bic: "BIC",
  accountName: "Kontoinhaber",
  paymentReference: "Verwendungszweck",
  allowanceTotal: "Rabatte gesamt",
  chargeTotal: "Zuschläge gesamt",
  taxExclusiveAmount: "Nettobetrag",
  taxAmount: "Umsatzsteuer",
  taxInclusiveAmount: "Rechnungsbetrag inkl. USt.",
  prepaidAmount: "Bereits bezahlt",
  payableRoundingAmount: "Rundung",
  payableAmount: "Zahlbetrag",
  reason: "Begründung",
  baseAmount: "Bezugsbetrag",
  percentage: "Prozentsatz",
  taxableAmount: "Steuerbemessungsgrundlage",
  rate: "Steuersatz",
  value: "Elektronische Adresse",
  schemeId: "Adressschema",
  meansCode: "Zahlungsart",
  buyerAccountingReference: "Kostenstelle",
  purchaseOrderLineReference: "Bestellposition",
};
export function changedFields(
  before: unknown,
  after: unknown,
  path = "",
): { path: string; before: unknown; after: unknown }[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (
    before &&
    after &&
    typeof before === "object" &&
    typeof after === "object"
  )
    return [
      ...new Set([...Object.keys(before), ...Object.keys(after)]),
    ].flatMap((k) =>
      changedFields(
        (before as any)[k],
        (after as any)[k],
        path ? `${path}.${k}` : k,
      ),
    );
  return [{ path, before, after }];
}
export function ChangeSummary({
  before,
  after,
}: {
  before: Invoice;
  after: Invoice;
}) {
  const { t } = useLanguage();
  const changes = changedFields(before, after);
  return (
    <section className="change-summary">
      <h3>{t("Änderungen prüfen")}</h3>
      {changes.length ? (
        <ul>
          {changes.map((c) => (
            <li key={c.path}>
              <strong>
                {t(editorLabels[c.path.split(".").at(-1)!] || c.path)}
              </strong>
              <small>{c.path}</small>
              <del>{String(c.before ?? "—")}</del> →{" "}
              <ins>{String(c.after ?? "—")}</ins>
            </li>
          ))}
        </ul>
      ) : (
        <p>{t("Noch keine Änderungen.")}</p>
      )}
    </section>
  );
}
export function InvoiceEditor({
  value,
  onChange,
}: {
  value: Invoice;
  onChange: (v: Invoice) => void;
}) {
  const { t, locale } = useLanguage();
  const fieldFindings = schemaFindings(value);
  const [section, setSection] = useState("document");
  const [calculationMessage, setCalculationMessage] = useState("");
  const update = (path: string, next: string) => {
    const copy = structuredClone(value);
    const parts = path.split(".");
    let node: any = copy;
    for (const key of parts.slice(0, -1)) node = node[key] ??= {};
    const key = parts.at(-1)!;
    const nullable =
      [
        "buyerReference",
        "purchaseOrderReference",
        "contractReference",
        "description",
        "additional",
        "vatId",
        "taxNumber",
        "dueDate",
        "terms",
        "iban",
        "bic",
        "accountName",
        "paymentReference",
        "buyerAccountingReference",
        "purchaseOrderLineReference",
        "baseAmount",
        "percentage",
      ].includes(key) || path.includes(".contact.");
    node[key] = next === "" && nullable ? null : next;
    setCalculationMessage("");
    onChange(copy);
  };
  const field = (path: string) => {
    const v = path.split(".").reduce((o: any, k) => o?.[k], value);
    const key = path.split(".").at(-1)!;
    const issue = fieldFindings.find((f) => f.canonicalPath === path);
    return (
      <label className="editor-field" key={path}>
        <span>{t(editorLabels[key] || key)}</span>
        <input
          data-field={path}
          aria-invalid={!!issue}
          aria-describedby={issue ? `error-${path}` : undefined}
          type={key === "issueDate" || key === "dueDate" ? "date" : "text"}
          value={v ?? ""}
          onChange={(e) => update(path, e.target.value)}
        />
        {issue && (
          <small id={`error-${path}`} className="field-error">
            {findingDescription(locale, issue)}
          </small>
        )}
      </label>
    );
  };
  return (
    <div className="invoice-editor">
      <div
        className="editor-sections"
        role="group"
        aria-label={t("Rechnung bearbeiten")}
      >
        {[
          ["document", "Rechnung"],
          ["seller", "Rechnungssteller"],
          ["buyer", "Rechnungsempfänger"],
          ["lines", "Positionen"],
          ["totals", "Beträge"],
          ["payment", "Zahlungsinformationen"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={section === key ? "secondary active" : "secondary"}
            aria-pressed={section === key}
            onClick={() => setSection(key)}
          >
            {t(label)}
          </button>
        ))}
      </div>
      {["lines", "totals"].includes(section) && (
        <div className="recalculation">
          <button
            className="secondary"
            onClick={() => {
              try {
                onChange(recalculateInvoice(value));
                setCalculationMessage(
                  "Beträge neu berechnet. Bitte prüfen Sie die Vorschau.",
                );
              } catch {
                setCalculationMessage(
                  "Berechnung nicht möglich. Prüfen Sie Zahlen, Mengen, Preisbasis und den unterstützten Steuersatz von 19 %.",
                );
              }
            }}
          >
            {t("Beträge neu berechnen")}
          </button>
          <p>
            {t(
              "Berechnet Positionssummen, Rabatte mit angegebenem Bezugsbetrag, Steuer und Restbetrag. Nur auf ausdrücklichen Klick.",
            )}
          </p>
          {calculationMessage && <p role="status">{t(calculationMessage)}</p>}
        </div>
      )}
      {section === "document" && (
        <div className="editor-fields">
          {[
            "number",
            "issueDate",
            "buyerReference",
            "purchaseOrderReference",
            "contractReference",
          ].map((k) => field(`document.${k}`))}
        </div>
      )}
      {["seller", "buyer"].includes(section) && (
        <div className="editor-fields">
          {[
            "name",
            "vatId",
            "taxNumber",
            "address.street",
            "address.additional",
            "address.postalCode",
            "address.city",
            "contact.name",
            "contact.email",
            "contact.phone",
            "electronicAddress.value",
            "electronicAddress.schemeId",
          ].map((k) => field(`${section}.${k}`))}
        </div>
      )}
      {section === "lines" &&
        value.lines.map((line, n) => (
          <fieldset key={n}>
            <legend>
              {t("Pos.")} {line.id}
            </legend>
            <div className="editor-fields">
              {[
                "name",
                "description",
                "quantity",
                "unitCode",
                "unitPrice.amount",
                "unitPrice.baseQuantity",
                "lineNetAmount",
                "buyerAccountingReference",
                "purchaseOrderLineReference",
              ].map((k) => field(`lines.${n}.${k}`))}
            </div>
          </fieldset>
        ))}
      {section === "totals" && (
        <>
          <p className="notice">
            {t(
              "Beträge werden nicht automatisch geändert. Prüfen Sie nach Preisänderungen auch Netto, Steuer und Zahlbetrag.",
            )}
          </p>
          <div className="editor-fields">
            {Object.keys(value.totals).map((k) => field(`totals.${k}`))}
          </div>
          {value.allowancesCharges.map((a, n) => (
            <fieldset key={n}>
              <legend>{t(a.charge ? "Zuschlag" : "Rabatt")}</legend>
              <div className="editor-fields">
                {["amount", "reason", "baseAmount", "percentage"].map((k) =>
                  field(`allowancesCharges.${n}.${k}`),
                )}
              </div>
            </fieldset>
          ))}
          {value.taxBreakdown.map((a, n) => (
            <fieldset key={n}>
              <legend>
                {t("Umsatzsteuer")} {a.rate}%
              </legend>
              <div className="editor-fields">
                {["taxableAmount", "taxAmount"].map((k) =>
                  field(`taxBreakdown.${n}.${k}`),
                )}
              </div>
            </fieldset>
          ))}
        </>
      )}
      {section === "payment" && (
        <div className="editor-fields">
          {[
            "meansCode",
            "dueDate",
            "terms",
            "iban",
            "bic",
            "accountName",
            "paymentReference",
          ].map((k) => field(`payment.${k}`))}
        </div>
      )}
    </div>
  );
}
