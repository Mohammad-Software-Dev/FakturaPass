# Remaining product decisions

The supplied START HERE document selects Release A. These decisions gate later production work and do not prevent the local demonstrator from running.

| ID  | Decision                               | Owner              | Gate               | Current behavior               |
| --- | -------------------------------------- | ------------------ | ------------------ | ------------------------------ |
| 001 | Production OIDC provider               | Product/technical  | B/C                | LOCAL identity only            |
| 002 | EU production hosting                  | Product/technical  | B/C                | Loopback local runtime         |
| 003 | Production private object storage      | Technical          | B/C                | PostgreSQL immutable bytes     |
| 004 | Email provider and transport semantics | Product            | Delivery           | No sending                     |
| 005 | Pricing, plans and billing provider    | Product            | Commercial         | No billing                     |
| 006 | First customer export mapping          | Customer/product   | Pilot              | Canonical JSON only            |
| 007 | Verified recipient requirements        | Domain/customer    | Pilot              | Synthetic/UNKNOWN only         |
| 008 | Retention and legal data terms         | Product/legal      | Real data          | Synthetic data only            |
| 009 | Pilot transport channel                | Customer/product   | Sending            | Downloads only                 |
| 010 | Reduced VAT fixture review             | Domain reviewer    | Reduced VAT        | Blocked                        |
| 011 | Credit note/correction semantics       | Domain/product     | Issued corrections | Immutable draft revisions only |
| 012 | ZUGFeRD profile and PDF/A validation   | Domain/technical   | C                  | No ZUGFeRD                     |
| 013 | RPO/RTO/support SLA                    | Product/operations | Production         | No production guarantee        |
| 014 | External security review               | Security reviewer  | C                  | Local automated checks         |
| 015 | Legal wording, DPA and subprocessors   | Product/legal      | Production         | No legal/tax advice            |

Decisions must cite evidence and update the relevant support matrix and fixtures. No production vendor, price, retention duration, tax rule or delivery route has been invented to close these gates.
