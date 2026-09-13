"use client";
import type { Invoice } from "../../../packages/contracts/types";
import { useLanguage } from "./language";

export function InvoiceReview({ invoice }: { invoice: Invoice }) {
  const { t, money, date, decimal } = useLanguage();
  const fields = [
    ["Rechnungsdatum", date(invoice.document.issueDate)],
    ["Käuferreferenz", invoice.document.buyerReference],
    ["Bestellnummer", invoice.document.purchaseOrderReference],
    ["Vertragsreferenz", invoice.document.contractReference],
    [
      "Fällig am",
      invoice.payment?.dueDate ? date(invoice.payment.dueDate) : null,
    ],
  ];
  return (
    <div className="invoice-review">
      <div className="parties">
        {[
          ["Rechnungssteller", invoice.seller],
          ["Rechnungsempfänger", invoice.buyer],
        ].map(([label, party]) => {
          const p = party as Invoice["seller"];
          return (
            <div key={String(label)}>
              <span className="eyebrow">{t(String(label))}</span>
              <h3>{p.name}</h3>
              <p>
                {p.address.street}
                <br />
                {p.address.additional && (
                  <>
                    {p.address.additional}
                    <br />
                  </>
                )}
                {p.address.postalCode} {p.address.city}
                <br />
                {p.address.countryCode === "DE"
                  ? t("Deutschland")
                  : p.address.countryCode}
              </p>
              <small>
                {t("USt-ID:")} {p.vatId ?? t("Nicht angegeben")}
              </small>
            </div>
          );
        })}
      </div>
      <dl className="review-references">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{t(label!)}</dt>
            <dd>{value || t("Nicht angegeben")}</dd>
          </div>
        ))}
      </dl>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t("Position / Beschreibung")}</th>
              <th>{t("Menge")}</th>
              <th>{t("Einzelpreis")}</th>
              <th>{t("Netto")}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l) => (
              <tr key={l.id}>
                <td>
                  <strong>{l.name}</strong>
                  <small>{l.description}</small>
                  <small>
                    {t("Umsatzsteuer")} {decimal(l.tax.rate)} %
                  </small>
                  {l.allowancesCharges.map((a, n) => (
                    <small key={n}>
                      {t(a.charge ? "Zuschlag" : "Rabatt")}: {a.reason}{" "}
                      {money(a.amount)}
                    </small>
                  ))}
                </td>
                <td data-label={t("Menge")}>
                  {decimal(l.quantity)}{" "}
                  {t(
                    l.unitCode === "HUR"
                      ? Number(l.quantity) === 1
                        ? "Stunde"
                        : "Stunden"
                      : l.unitCode === "C62"
                        ? Number(l.quantity) === 1
                          ? "Einzelstück"
                          : "Stück"
                        : l.unitCode,
                  )}
                </td>
                <td data-label={t("Einzelpreis")}>
                  {money(l.unitPrice.amount)}
                  {l.unitPrice.baseQuantity !== "1" && (
                    <small>
                      {t("je")} {decimal(l.unitPrice.baseQuantity)}
                    </small>
                  )}
                </td>
                <td data-label={t("Netto")}>{money(l.lineNetAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="totals review-totals">
        <div>
          <span>{t("Positionssumme")}</span>
          <strong>{money(invoice.totals.lineNetAmount)}</strong>
        </div>
        {invoice.allowancesCharges.map((a, n) => (
          <div key={n}>
            <span>
              {t(a.charge ? "Zuschlag" : "Rabatt")} · {a.reason || a.reasonCode}
            </span>
            <strong>
              {a.charge ? "+" : "−"}
              {money(a.amount)}
            </strong>
          </div>
        ))}
        <div>
          <span>{t("Nettobetrag")}</span>
          <strong>{money(invoice.totals.taxExclusiveAmount)}</strong>
        </div>
        {invoice.taxBreakdown.map((tax, n) => (
          <div key={n}>
            <span>
              {t("Umsatzsteuer")} {decimal(tax.rate)} %{" "}
              <small>({money(tax.taxableAmount)})</small>
            </span>
            <strong>{money(tax.taxAmount)}</strong>
          </div>
        ))}
        <div>
          <span>{t("Rechnungsbetrag inkl. USt.")}</span>
          <strong>{money(invoice.totals.taxInclusiveAmount)}</strong>
        </div>
        <div>
          <span>{t("Bereits bezahlt")}</span>
          <strong>−{money(invoice.totals.prepaidAmount)}</strong>
        </div>
        {Number(invoice.totals.payableRoundingAmount) !== 0 && (
          <div>
            <span>{t("Rundung")}</span>
            <strong>{money(invoice.totals.payableRoundingAmount)}</strong>
          </div>
        )}
        <div className="total">
          <span>{t("Zahlbetrag")}</span>
          <strong>{money(invoice.totals.payableAmount)}</strong>
        </div>
      </div>
      {invoice.payment && (
        <details className="payment-details" open>
          <summary>{t("Zahlungsinformationen")}</summary>
          <p>{invoice.payment.terms}</p>
          <dl className="review-references">
            {[
              ["Kontoinhaber", invoice.payment.accountName],
              ["IBAN", invoice.payment.iban],
              ["BIC", invoice.payment.bic],
              ["Verwendungszweck", invoice.payment.paymentReference],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{t(k!)}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
        </details>
      )}
    </div>
  );
}
