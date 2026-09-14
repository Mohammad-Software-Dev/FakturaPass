# Release A supported cases

| Case                                                          | Behavior                                                                                      |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Canonical JSON v1, DE seller/buyer, EUR invoice               | Supported                                                                                     |
| CSV with an explicitly registered, versioned mapping          | Grouped dry run and atomic import within the same invoice support boundary; see CSV_IMPORT.md |
| Explicit VAT category S at 19%                                | Supported; no tax-treatment inference                                                         |
| Decimal quantities and positive base quantity                 | Exact decimal validation                                                                      |
| Line/document allowances and charges                          | Checked arithmetic and official UBL rules                                                     |
| Payment references, IBAN, buyer/PO/contract references        | Preserved from explicit input                                                                 |
| Synthetic recipient profiles                                  | Three read-only profiles, clearly unverified                                                  |
| Missing recipient profile                                     | UNKNOWN informational coverage; no acceptance claim                                           |
| Reduced/mixed VAT                                             | PENDING_SUPPORT, TBD-010                                                                      |
| Reverse charge, exempt/Kleinunternehmer                       | Blocked unsupported                                                                           |
| Foreign currency, foreign seller/buyer, credit notes          | Rejected by closed Release A schema                                                           |
| Attachments                                                   | Metadata representable; actual attachment generation blocked                                  |
| Sending, Peppol, email, billing, ZUGFeRD, production identity | Not implemented in Release A; later release gates                                             |

API amounts, rates and quantities are strings. Rounding is half-up to two decimal places for calculated line and tax amounts. Declared amounts are never silently changed. Official validation warnings and informational rules remain visible even on a passing artifact.
