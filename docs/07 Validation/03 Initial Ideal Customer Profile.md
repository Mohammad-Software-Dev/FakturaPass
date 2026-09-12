# FakturaPass Initial Ideal Customer Profile

**Status:** Discovery hypothesis—not yet validated  
**Iteration:** 2  
**Primary market:** Germany  
**Use:** Prospect selection, interview recruiting, pilot qualification, and early product boundaries

## 1. Beachhead customer

The initial ideal customer is:

> A German B2B supplier with 20–200 employees that sends 200–5,000 invoices per month from a legacy, customized, vertical, or internally built ERP and serves public bodies or large enterprises with strict invoice-routing requirements.

The company has enough invoice complexity and operational exposure to pay for a reliable integration, but is too small—or its ERP is too specialized—for a broad enterprise tax-compliance transformation.

FakturaPass should initially optimize for this segment, not for every German company affected by e-invoicing.

## 2. Why this segment is attractive

### Urgency

- It must already receive structured invoices.
- It is preparing to issue structured invoices as German transition periods end.
- Large customers and public bodies may impose requirements earlier through procurement or supplier policies.
- A rejected invoice can delay cash collection or create a customer escalation.

### Pain

- The ERP may produce PDFs or incomplete exports rather than compliant structured invoices.
- Generic format validation does not cover each recipient's routing and reference requirements.
- Finance and IT teams manually coordinate corrections.
- Customer instructions are scattered across PDFs, portals, emails, contracts, and internal notes.
- Rejection feedback is often difficult to connect to the source ERP field.

### Ability to pay

- Invoice failures consume finance, IT, and consultant time.
- The organization has more budget than a freelancer or microbusiness.
- Avoiding ERP replacement or bespoke integration can justify onboarding and recurring fees.
- A fixed-scope paid audit is small relative to a typical ERP project.

### Reachability

- ERP consultants and managed IT providers already serve the segment.
- Suppliers to public bodies and large enterprises can be identified through procurement information and supplier instructions.
- Relevant finance and operations roles are discoverable through professional networks and LinkedIn.

## 3. Firmographic criteria

### Strong fit

| Attribute | Strong-fit signal |
|---|---|
| Country | German legal entity issuing domestic B2B invoices |
| Employees | 20–200 |
| Annual revenue | Approximately €3 million–€100 million; use only as a supporting indicator |
| Invoice volume | 200–5,000 outbound invoices per month |
| Customer mix | Public sector, regulated buyers, or large enterprises |
| Billing environment | Legacy, customized, vertical, or internally developed system |
| Finance team | At least one dedicated finance or billing role |
| IT support | Internal IT owner, external ERP consultant, or managed service provider |
| Change posture | Wants compliance without replacing the source system |
| Current stage | Actively assessing, implementing, or repairing e-invoicing workflows |

### Acceptable adjacent fit

- 5–19 employees with unusually high invoice complexity or important public-sector customers.
- 201–500 employees with a bounded German entity and no demand for immediate multi-country coverage.
- Companies issuing fewer than 200 invoices monthly when invoice values or customer requirements make failures expensive.
- ERP implementation partners that can aggregate several end customers behind a repeatable integration pattern.

### Weak fit

- Very low invoice volume and simple customer relationships.
- Standard cloud accounting software that already solves the entire workflow.
- Companies willing and able to replace the ERP immediately.
- Buyers whose only need is a free manual invoice form.
- Multinational tax departments demanding broad country coverage, certifications, and enterprise SLAs from day one.

## 4. Technographic criteria

### High-priority source environments

- CSV exports generated from an existing ERP or Warenwirtschaft system.
- JSON exports or REST APIs from internal billing applications.
- Scheduled SFTP or shared-folder invoice batches.
- Custom Microsoft Dynamics, Sage, abas, or vertical ERP installations.
- Internally developed billing tools maintained by a small software or IT team.

### Positive technical signals

- The company can export invoice header and line data in a stable structure.
- A technical owner can explain the current workflow.
- The company has sample accepted and rejected invoices.
- Customer-specific references exist somewhere in the source data or can be enriched safely.
- The company accepts a staged integration rather than demanding every ERP feature immediately.

### Technical warning signals

- No repeatable data export is available.
- Required values do not exist and cannot be added or maintained.
- The company expects FakturaPass to infer legally authoritative tax data without confirmation.
- Each invoice requires unique manual interpretation.
- Production access is required before a sandbox test can be performed.
- The customer expects FakturaPass to become its complete accounting system or legal archive.

## 5. Operational pain profile

A strong prospect has experienced at least two of the following:

- invoices rejected for missing or malformed buyer references;
- purchase-order numbers placed in the wrong structured field;
- different customers requiring different formats or versions;
- manual portal entry after the ERP already produced an invoice;
- unclear delivery or acceptance status;
- customer-specific attachment or filename conventions;
- repeated coordination between accounts receivable, IT, and an ERP consultant;
- validation results that identify an XML rule but not the ERP field to fix;
- delayed payment while an invoice is corrected and resubmitted;
- no central ownership of recipient rules;
- fear that a standards or rule-version update will break previously working invoices.

The prospect becomes especially attractive when these problems repeat across multiple invoices or recipients.

## 6. Trigger events

Prioritize prospects experiencing one or more current triggers:

1. A major customer announces that it will stop accepting PDFs.
2. A public-sector contract requires XRechnung or a specific buyer reference.
3. The company enters an e-invoicing implementation project for the German mandate.
4. Recent invoices were rejected or payment was delayed.
5. An ERP vendor proposes an expensive upgrade or custom integration.
6. The existing converter produces valid output but cannot satisfy customer-specific requirements.
7. The finance team is manually re-entering invoice information into portals.
8. The company is changing ERP consultants or consolidating invoice workflows.
9. A customer or auditor asks for traceable proof of validation and delivery.
10. The internal software team is being asked to maintain changing invoice standards.

## 7. Buyer and stakeholder map

### Economic buyer

Likely roles:

- CFO or Head of Finance;
- Managing Director in a smaller organization;
- Head of Operations or Shared Services;
- IT Director where e-invoicing is treated as an integration project.

What they care about:

- payment delays and customer escalation;
- implementation cost and deadline risk;
- avoiding ERP replacement;
- accountability, evidence, and predictable support;
- a bounded project with a credible production path.

### Operational champion

Likely roles:

- Accounts Receivable Lead;
- Billing Manager;
- Finance Operations Manager;
- senior accountant responsible for customer invoices.

What they care about:

- fewer corrections and portal steps;
- understandable errors;
- knowing whether an invoice was accepted;
- customer rules in one place;
- a clear exception workflow.

### Technical owner

Likely roles:

- ERP Administrator;
- internal software engineer;
- IT Manager;
- external ERP consultant or managed IT provider.

What they care about:

- stable input and output contracts;
- sandbox testing;
- minimal changes to the source system;
- versioned rules and predictable APIs;
- observable errors and clear responsibility boundaries.

### Influencers and blockers

- tax adviser or accountant;
- data-protection officer;
- information-security owner;
- procurement;
- works council where employee data or workflow monitoring is implicated;
- the customer's ERP vendor or implementation partner.

## 8. Jobs to be done

### Primary functional job

> When my existing ERP produces an invoice, help me transform and validate it for the specific recipient, deliver or return the correct artifact, and show me what happened—without replacing the ERP.

### Supporting jobs

- Map existing exports to a stable invoice model.
- Identify missing data before an invoice leaves.
- Explain errors in terms finance and IT can act on.
- Maintain recipient-specific requirements centrally.
- Preserve the original, generated artifact, validation version, and delivery evidence.
- Test representative invoices when standards or recipient rules change.
- Route ambiguous cases to a person rather than silently guessing.

### Emotional and organizational jobs

- Reduce anxiety around the 2027/2028 transition.
- Avoid blame between finance, IT, consultants, and customers.
- Demonstrate control to management and important buyers.
- Preserve investment in a specialized ERP.

## 9. Qualification scorecard

Score each prospect from 0–2.

| Criterion | 0 | 1 | 2 |
|---|---|---|---|
| Invoice volume | Under 50/month | 50–199/month | 200–5,000/month |
| Source-system friction | Standard system solves it | Some customization | Legacy, vertical, or internally built |
| Recipient complexity | Mostly small customers | Some enterprise customers | Public bodies or several strict enterprises |
| Failure frequency | None or hypothetical | Occasional | Repeated monthly or more |
| Business impact | Minor | Material staff time | Delayed cash or escalation |
| Urgency | No project | General deadline concern | Active project, rejection, or buyer deadline |
| Artifact access | None | Screenshots/descriptions | Anonymized exports and failures |
| Buying access | User only | Influencer involved | Budget owner involved |
| Reusability | Appears unique | Some common patterns | Clear repeatable export or recipient pattern |
| Paid commitment | No interest | Follow-up/proposal | Paid audit, LOI, or pilot |

Maximum score: 20.

- **15–20:** design-partner priority;
- **10–14:** discovery priority;
- **6–9:** secondary or nurture;
- **0–5:** disqualify unless strategically informative.

## 10. Design-partner criteria

A first design partner should:

- score at least 15/20;
- provide a stable sample export and at least 20 representative invoices;
- identify up to five important recipients;
- share rejection evidence or recipient instructions;
- provide both a finance and technical contact;
- agree to a bounded input and output scope;
- commit time for testing and weekly feedback;
- pay for an audit or pilot, even if discounted;
- permit anonymized learnings to improve reusable mappings and rules;
- accept that early delivery may include controlled manual operations.

Avoid taking a logo solely for prestige if its requirements distort the first product.

## 11. Negative ICP

FakturaPass should actively say “not yet” to:

### Freelancers and microbusinesses seeking invoice creation

Their need is real, but low-cost accounting tools and free invoice generators create a low price ceiling. Manual creation can later serve as an acquisition feature, not the initial business model.

### Enterprises seeking global tax infrastructure

They will require multi-country coverage, certifications, high availability, procurement maturity, and managed operations. This creates a long sales cycle and an unsustainable first scope.

### Companies seeking autonomous PDF conversion without review

The structured data becomes authoritative. FakturaPass should not promise that uncertain OCR output is legally correct without confirmation.

### Companies seeking complete accounts-payable automation

Inbound capture, approval, booking, and payment are adjacent but different workflows. The first wedge is outbound recipient acceptance.

### Companies without a reusable integration path

If every invoice requires bespoke interpretation and the source system cannot provide stable data, the work is consultancy rather than scalable software.

## 12. Prospecting filters

### Suggested search combinations

- `XRechnung Lieferantenanforderungen` plus industry or region;
- `E-Rechnung ERP` plus a legacy or vertical ERP name;
- `Debitorenbuchhaltung XRechnung`;
- `Rechnungsprüfung Lieferantenportal`;
- companies hiring for `E-Rechnung`, `ERP Integration`, `EDI`, or `Debitoren`;
- ERP consultants mentioning XRechnung, ZUGFeRD, DATEV, Sage, abas, or Dynamics.

### Outreach priority order

1. Warm introductions to finance leaders with recent invoice failures.
2. ERP consultants managing several relevant customers.
3. Suppliers to public bodies with published invoice instructions.
4. Mid-market industrial and professional-service suppliers to large enterprises.
5. Broader cold outreach for comparison and disconfirming evidence.

## 13. Initial vertical hypotheses

These are research priorities, not committed markets.

| Vertical | Why it may fit | Main caution |
|---|---|---|
| Specialized manufacturing suppliers | Enterprise buyers, POs, legacy ERP, attachments | EDI incumbents may already be strong |
| Engineering and technical services | Project references, timesheets, public-sector work | Invoice volume may be modest |
| Facility and maintenance services | Many sites, cost centers, enterprise recipients | Field-service platforms may own billing |
| IT and managed services | Contract references, mixed recurring/project billing | Modern billing systems may reduce pain |
| Medical or laboratory suppliers | Strict buyers and sensitive data | Higher security and regulatory burden |
| Construction subsegments | Complex references and supporting documents | Existing vertical tools and complex tax rules |

Discovery should identify a repeated subsegment rather than selecting a vertical from theory alone.

## 14. What must be validated next

1. Whether the 20–200 employee range has sufficient budget and urgency.
2. Which ERP or export pattern repeats across at least three qualified prospects.
3. Which recipient requirement causes the most expensive recurring failure.
4. Whether finance or IT owns the budget.
5. Whether a €500–€1,500 acceptance audit receives paid commitments.
6. Whether prospects value recipient-aware preflight more than generic format generation.
7. Whether the first production path should return files to the ERP, send by email, or include a delivery provider.
8. Whether an ERP-partner channel improves trust and lowers acquisition cost.

## 15. ICP revision rule

Review this document after every five qualified interviews. Change a criterion only when:

- the same evidence appears in at least three organizations;
- a paid commitment contradicts the current assumption; or
- a critical technical, legal, or procurement constraint makes the segment uneconomic.

Maintain rejected assumptions in the interview tracker so that the ICP does not drift toward whichever prospect was interviewed most recently.

