# Example customer invoice

`customer-invoice-consulting.json` is a realistic, fully synthetic ERP export for testing FakturaPass. It describes a German consulting invoice with three line items, 19% VAT, buyer and purchase-order references, payment terms and bank-transfer details.

Expected result:

- Preview total: EUR 2,045.61 (German UI: 2.045,61 EUR)
- Canonical schema and monetary checks: pass
- Official XRechnung validation: pass, possibly with the informational `BR-DE-TMP-32` recommendation about a service date or period
- Recipient profile: use no profile for an unknown recipient, or choose the buyer-reference demo profile to exercise a passing synthetic recipient requirement
- Approval, XRechnung generation and XML/evidence downloads: available after validation

All names, addresses, registration identifiers, tax identifiers, email addresses and references are synthetic. The `.example` email domain cannot receive mail. Do not treat this file as accounting, tax or payment data.

## Office equipment with a project discount

`customer-invoice-office-equipment.json` represents a supplier invoice for office chairs, monitor arms and installation work. It includes physical quantities, purchase-order line references, accounting references and a document-level 5% discount.

Expected result:

- Preview total: EUR 3,098.70 (German UI: 3.098,70 EUR)
- Discount: EUR 137.05; taxable amount after discount: EUR 2,603.95
- Canonical schema, monetary checks and official XRechnung validation: pass
- Recipient profile: choose the purchase-order demo profile to exercise the order-reference requirement

## Brand project with a prepayment

`customer-invoice-brand-project.json` represents a creative-agency invoice with fractional consulting hours, a fixed-price brand kit and a EUR 500.00 prepayment already received. It uses a contract reference instead of a purchase order.

Expected result:

- Gross invoice amount: EUR 2,739.98
- Prepayment: EUR 500.00; remaining amount due: EUR 2,239.98 (German UI: 2.239,98 EUR)
- Canonical schema, monetary checks and official XRechnung validation: pass
- Recipient profile: choose the contract-reference demo profile to exercise the contract-reference requirement

The official validator may add informational `BR-DE-TMP-32` guidance to either example. This does not make the invoice invalid. All data in both files is synthetic and intended solely for testing.
