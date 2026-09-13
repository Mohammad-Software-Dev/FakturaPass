# Example customer invoice

`customer-invoice-consulting.json` is a realistic, fully synthetic ERP export for testing FakturaPass. It describes a German consulting invoice with three line items, 19% VAT, buyer and purchase-order references, payment terms and bank-transfer details.

Expected result:

- Preview total: EUR 2,045.61 (German UI: 2.045,61 EUR)
- Canonical schema and monetary checks: pass
- Official XRechnung validation: pass, possibly with the informational `BR-DE-TMP-32` recommendation about a service date or period
- Recipient profile: use no profile for an unknown recipient, or choose the buyer-reference demo profile to exercise a passing synthetic recipient requirement
- Approval, XRechnung generation and XML/evidence downloads: available after validation

All names, addresses, registration identifiers, tax identifiers, email addresses and references are synthetic. The `.example` email domain cannot receive mail. Do not treat this file as accounting, tax or payment data.
