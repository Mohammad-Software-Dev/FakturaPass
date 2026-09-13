import type { Invoice, Party, AllowanceCharge } from "../contracts/types";
export const escapeXml = (v: string) =>
  v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
const e = (name: string, v: string | null | undefined, attrs = "") =>
  v == null ? "" : `<${name}${attrs}>${escapeXml(v)}</${name}>`;
const c = (name: string, v: string) => `<cac:${name}>${v}</cac:${name}>`;
const b = (name: string, v: string | null | undefined, attrs = "") =>
  e(`cbc:${name}`, v, attrs);
const amount = (name: string, v: string) => b(name, v, ' currencyID="EUR"');
const tax = (t: { categoryCode: string; rate: string }) =>
  b("ID", t.categoryCode) +
  b("Percent", t.rate) +
  c("TaxScheme", b("ID", "VAT"));
function party(p: Party) {
  return c(
    "Party",
    b(
      "EndpointID",
      p.electronicAddress.value,
      ` schemeID="${escapeXml(p.electronicAddress.schemeId)}"`,
    ) +
      (p.tradingName ? c("PartyName", b("Name", p.tradingName)) : "") +
      c(
        "PostalAddress",
        b("StreetName", p.address.street) +
          b("AdditionalStreetName", p.address.additional) +
          b("CityName", p.address.city) +
          b("PostalZone", p.address.postalCode) +
          c("Country", b("IdentificationCode", p.address.countryCode)),
      ) +
      (p.vatId
        ? c(
            "PartyTaxScheme",
            b("CompanyID", p.vatId) + c("TaxScheme", b("ID", "VAT")),
          )
        : "") +
      (p.taxNumber
        ? c(
            "PartyTaxScheme",
            b("CompanyID", p.taxNumber) + c("TaxScheme", b("ID", "FC")),
          )
        : "") +
      c(
        "PartyLegalEntity",
        b("RegistrationName", p.name) +
          (p.legalRegistrationId
            ? b(
                "CompanyID",
                p.legalRegistrationId.value,
                p.legalRegistrationId.schemeId
                  ? ` schemeID="${escapeXml(p.legalRegistrationId.schemeId)}"`
                  : "",
              )
            : ""),
      ) +
      (p.contact
        ? c(
            "Contact",
            b("Name", p.contact.name) +
              b("Telephone", p.contact.phone) +
              b("ElectronicMail", p.contact.email),
          )
        : ""),
  );
}
function adjustment(a: AllowanceCharge, document: boolean) {
  return c(
    "AllowanceCharge",
    b("ChargeIndicator", String(a.charge)) +
      b("AllowanceChargeReasonCode", a.reasonCode) +
      b("AllowanceChargeReason", a.reason) +
      (a.percentage != null ? b("MultiplierFactorNumeric", a.percentage) : "") +
      amount("Amount", a.amount) +
      (a.baseAmount != null ? amount("BaseAmount", a.baseAmount) : "") +
      (document && a.tax ? c("TaxCategory", tax(a.tax)) : ""),
  );
}
export function generateUbl(i: Invoice): string {
  const p = i.payment;
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">` +
    b(
      "CustomizationID",
      "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0",
    ) +
    b("ProfileID", "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0") +
    b("ID", i.document.number) +
    b("IssueDate", i.document.issueDate) +
    b("DueDate", p?.dueDate) +
    b("InvoiceTypeCode", "380") +
    b("DocumentCurrencyCode", i.document.currency) +
    b("BuyerReference", i.document.buyerReference) +
    (i.document.purchaseOrderReference
      ? c("OrderReference", b("ID", i.document.purchaseOrderReference))
      : "") +
    (i.document.contractReference
      ? c("ContractDocumentReference", b("ID", i.document.contractReference))
      : "") +
    c("AccountingSupplierParty", party(i.seller)) +
    c("AccountingCustomerParty", party(i.buyer)) +
    (p
      ? c(
          "PaymentMeans",
          b("PaymentMeansCode", p.meansCode) +
            b("PaymentID", p.paymentReference) +
            (p.iban
              ? c(
                  "PayeeFinancialAccount",
                  b("ID", p.iban) +
                    b("Name", p.accountName) +
                    (p.bic
                      ? c("FinancialInstitutionBranch", b("ID", p.bic))
                      : ""),
                )
              : ""),
        )
      : "") +
    (p?.terms ? c("PaymentTerms", b("Note", p.terms)) : "") +
    i.allowancesCharges.map((a) => adjustment(a, true)).join("") +
    c(
      "TaxTotal",
      amount("TaxAmount", i.totals.taxAmount) +
        i.taxBreakdown
          .map((t) =>
            c(
              "TaxSubtotal",
              amount("TaxableAmount", t.taxableAmount) +
                amount("TaxAmount", t.taxAmount) +
                c("TaxCategory", tax(t)),
            ),
          )
          .join(""),
    ) +
    c(
      "LegalMonetaryTotal",
      Object.entries({
        LineExtensionAmount: i.totals.lineNetAmount,
        TaxExclusiveAmount: i.totals.taxExclusiveAmount,
        TaxInclusiveAmount: i.totals.taxInclusiveAmount,
        AllowanceTotalAmount: i.totals.allowanceTotal,
        ChargeTotalAmount: i.totals.chargeTotal,
        PrepaidAmount: i.totals.prepaidAmount,
        PayableRoundingAmount: i.totals.payableRoundingAmount,
        PayableAmount: i.totals.payableAmount,
      })
        .map(([k, v]) => amount(k, v))
        .join(""),
    ) +
    i.lines
      .map((l) =>
        c(
          "InvoiceLine",
          b("ID", l.id) +
            b(
              "InvoicedQuantity",
              l.quantity,
              ` unitCode="${escapeXml(l.unitCode)}"`,
            ) +
            amount("LineExtensionAmount", l.lineNetAmount) +
            b("AccountingCost", l.buyerAccountingReference) +
            (l.purchaseOrderLineReference
              ? c(
                  "OrderLineReference",
                  b("LineID", l.purchaseOrderLineReference),
                )
              : "") +
            l.allowancesCharges.map((a) => adjustment(a, false)).join("") +
            c(
              "Item",
              b("Description", l.description) +
                b("Name", l.name) +
                c("ClassifiedTaxCategory", tax(l.tax)),
            ) +
            c(
              "Price",
              amount("PriceAmount", l.unitPrice.amount) +
                b(
                  "BaseQuantity",
                  l.unitPrice.baseQuantity,
                  ` unitCode="${escapeXml(l.unitCode)}"`,
                ),
            ),
        ),
      )
      .join("") +
    "</Invoice>\n"
  );
}
