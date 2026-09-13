import Decimal from "decimal.js";
import type { Invoice, AllowanceCharge } from "../contracts/types";
const D = Decimal.clone({ precision: 160, rounding: Decimal.ROUND_HALF_UP });
/** Explicit draft operation only: original imported values are never silently repaired. */
export function recalculateInvoice(source: Invoice): Invoice {
  const invoice = structuredClone(source);
  const money = (value: Decimal) => value.toFixed(2);
  const sum = (values: string[]) =>
    values.reduce((total, v) => total.plus(v), new D(0));
  const adjustment = (a: AllowanceCharge) => {
    if (a.baseAmount != null && a.percentage != null)
      a.amount = money(new D(a.baseAmount).times(a.percentage).div(100));
  };
  if (
    invoice.lines.some(
      (l) => l.tax.categoryCode !== "S" || !new D(l.tax.rate).eq(19),
    ) ||
    invoice.allowancesCharges.some(
      (a) => a.tax?.categoryCode !== "S" || !new D(a.tax.rate).eq(19),
    )
  )
    throw new Error("UNSUPPORTED");
  invoice.lines.forEach((line) => {
    if (
      new D(line.unitPrice.baseQuantity).lte(0) ||
      new D(line.quantity).lte(0)
    )
      throw new Error("QUANTITY");
    line.allowancesCharges.forEach(adjustment);
    line.lineNetAmount = money(
      new D(line.quantity)
        .times(line.unitPrice.amount)
        .div(line.unitPrice.baseQuantity)
        .plus(
          sum(
            line.allowancesCharges.filter((a) => a.charge).map((a) => a.amount),
          ),
        )
        .minus(
          sum(
            line.allowancesCharges
              .filter((a) => !a.charge)
              .map((a) => a.amount),
          ),
        ),
    );
  });
  invoice.allowancesCharges.forEach(adjustment);
  const line = sum(invoice.lines.map((l) => l.lineNetAmount));
  const allowance = sum(
    invoice.allowancesCharges.filter((a) => !a.charge).map((a) => a.amount),
  );
  const charge = sum(
    invoice.allowancesCharges.filter((a) => a.charge).map((a) => a.amount),
  );
  const net = line.minus(allowance).plus(charge);
  const tax = new D(money(net.times(19).div(100)));
  const gross = net.plus(tax);
  invoice.taxBreakdown = [
    {
      categoryCode: "S",
      rate: "19",
      taxableAmount: money(net),
      taxAmount: money(tax),
    },
  ];
  Object.assign(invoice.totals, {
    lineNetAmount: money(line),
    allowanceTotal: money(allowance),
    chargeTotal: money(charge),
    taxExclusiveAmount: money(net),
    taxAmount: money(tax),
    taxInclusiveAmount: money(gross),
    payableAmount: money(
      gross
        .minus(invoice.totals.prepaidAmount)
        .plus(invoice.totals.payableRoundingAmount),
    ),
  });
  return invoice;
}
