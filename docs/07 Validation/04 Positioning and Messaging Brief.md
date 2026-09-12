# FakturaPass Positioning and Messaging Brief

**Status:** Discovery hypothesis—not yet market-tested  
**Iteration:** 2  
**Primary audience:** German mid-market suppliers using existing ERP or billing systems  
**Purpose:** Keep outreach, interviews, pilots, and future landing-page copy consistent

## 1. Positioning statement

For German suppliers that must send structured invoices from an existing ERP, FakturaPass is a recipient-aware e-invoice bridge that transforms, validates, and preflights invoice data for the customer who must process it. Unlike generic converters and validators, FakturaPass connects errors to source fields, applies known recipient requirements, and provides traceable delivery evidence without forcing an ERP replacement.

## 2. Category

Use this category during discovery:

> Recipient-aware e-invoice bridge for existing ERP systems

Supporting category descriptions:

- e-invoice preflight and delivery layer;
- legacy-ERP e-invoicing bridge;
- outbound invoice acceptance infrastructure.

Avoid inventing an abstract category that customers do not recognize. Lead with e-invoicing and the existing ERP; explain recipient-aware preflight as the differentiation.

## 3. Core promise

### English

> Keep your ERP. Send e-invoices your customers can actually process.

### German

> Behalten Sie Ihr ERP. Senden Sie E-Rechnungen, die Ihre Kunden wirklich verarbeiten können.

This promise is directional, not an unconditional guarantee of acceptance or payment. Supporting copy must clarify that FakturaPass checks against applicable standards and known recipient requirements.

## 4. One-line explanation

### English

FakturaPass turns existing ERP output into XRechnung or ZUGFeRD, validates it against official and recipient-specific rules, and returns a traceable result.

### German

FakturaPass wandelt die Daten Ihres bestehenden ERP in XRechnung oder ZUGFeRD um, prüft sie gegen offizielle und empfängerspezifische Regeln und liefert ein nachvollziehbares Ergebnis zurück.

## 5. Short pitch

### English

Your ERP may be able to create an invoice, but that does not mean every customer can route and process it. FakturaPass sits between your billing system and the recipient. It maps existing exports, creates compliant structured invoices, detects preventable rejection risks, explains what needs to be corrected, and records the validation and delivery path—without replacing the source system.

### German

Ihr ERP kann eine Rechnung erzeugen. Das bedeutet jedoch nicht, dass jeder Kunde sie korrekt zuordnen und verarbeiten kann. FakturaPass sitzt zwischen Ihrem Abrechnungssystem und dem Empfänger. Die Lösung übernimmt bestehende Exporte, erzeugt strukturierte E-Rechnungen, erkennt vermeidbare Ablehnungsrisiken, zeigt konkrete Korrekturen und dokumentiert Prüfung und Übermittlung—ohne das Quellsystem zu ersetzen.

## 6. Target audience

Primary:

- German suppliers with 20–200 employees;
- 200–5,000 outbound invoices per month;
- legacy, customized, vertical, or internally built ERP;
- public-sector or large-enterprise customers;
- active e-invoicing project, deadline, or rejection problem.

Secondary:

- ERP implementers and specialized IT consultants serving several such customers;
- larger German entities with a bounded local workflow;
- smaller suppliers with unusually strict recipients or high invoice values.

## 7. Customer problem narrative

The customer does not primarily wake up wanting XML. The real situation is:

1. The existing billing system contains the commercial invoice data.
2. Replacing or heavily upgrading it is expensive and risky.
3. Structured formats introduce mandatory fields and technical rules.
4. Important recipients add their own references, identifiers, formats, attachments, and channels.
5. A technically valid invoice can still be rejected or misrouted.
6. Finance sees the failure, but IT or a consultant must trace it back to the source.
7. Every correction delays processing and may delay payment.

FakturaPass should be positioned as the controlled compatibility layer between these realities.

## 8. Value pillars

### 1. Preserve the existing ERP

**Message:** Add compliant e-invoicing without beginning an ERP replacement.

**Proof to develop:** Supported CSV/JSON/API patterns, bounded onboarding, sandbox mapping, production example.

**Customer outcome:** Lower implementation risk and faster path to readiness.

### 2. Check more than file validity

**Message:** Validate standards plus known recipient-specific requirements before sending.

**Proof to develop:** Recipient profiles, customer-rule checks, representative prevented failures.

**Customer outcome:** Fewer preventable rejections and less manual correction.

### 3. Make errors actionable

**Message:** Explain which source field must change, not only which XML rule failed.

**Proof to develop:** Error-to-source mapping, finance-friendly messages, before-and-after examples.

**Customer outcome:** Faster resolution and clearer responsibility between finance and IT.

### 4. Provide traceable evidence

**Message:** Record what was generated, which rules were used, and what happened during delivery.

**Proof to develop:** Versioned validation report, payload hash, timestamps, acknowledgement and rejection states.

**Customer outcome:** Operational control, reproducibility, and simpler support.

### 5. Adapt as rules change

**Message:** Keep format and recipient rules outside the ERP and test changes before production.

**Proof to develop:** Versioned rules, regression tests, change notifications, replayable invoice corpus.

**Customer outcome:** Reduced maintenance burden on internal systems.

## 9. Differentiation

| Alternative | What it does well | Where FakturaPass should differ |
|---|---|---|
| Accounting and invoice-writing software | Affordable end-to-end invoicing for small businesses | Preserve specialized ERP and existing billing workflow |
| Generic invoice API or converter | Creates and validates structured formats | Add source mapping, recipient profiles, remediation, and evidence |
| Free validator | Confirms technical rule compliance | Explain business corrections and support production workflow |
| ERP add-on or custom integration | Deep connection to one system | Offer a reusable layer across selected legacy and custom systems |
| Enterprise compliance network | Broad countries, channels, managed operations | Serve German mid-market customers with narrower scope and faster onboarding |
| Customer portal | Satisfies one recipient | Reuse one integration across several recipients and channels |

Do not claim that competitors lack a feature without current evidence. Position around the complete workflow FakturaPass intends to own.

## 10. Message hierarchy

Use messages in this order:

1. **Outcome:** Fewer preventable invoice rejections and a traceable result.
2. **Context:** Keep the existing ERP or billing system.
3. **Mechanism:** Transform, validate, and preflight against recipient requirements.
4. **Formats:** XRechnung and ZUGFeRD.
5. **Evidence:** Actionable corrections, rule versions, and delivery history.

Do not lead with EN 16931, UBL, CII, XML schemas, or AI. These support credibility after the business problem is understood.

## 11. Landing-page message draft

### German primary version

#### Hero headline

**E-Rechnungen aus Ihrem bestehenden ERP—geprüft für den tatsächlichen Empfänger.**

#### Hero subheadline

FakturaPass wandelt vorhandene Rechnungsdaten in XRechnung oder ZUGFeRD um, prüft offizielle und bekannte kundenspezifische Anforderungen und zeigt Korrekturen, bevor vermeidbare Fehler beim Empfänger entstehen.

#### Primary call to action

**Rechnungsprozess prüfen lassen**

#### Secondary call to action

**Kostenloses Erstgespräch vereinbaren**

#### Supporting bullets

- Bestehendes ERP behalten
- CSV, JSON oder API anbinden
- XRechnung und ZUGFeRD erzeugen
- Empfängerspezifische Referenzen vorab prüfen
- Fehler bis zum Quellfeld zurückverfolgen
- Prüfung und Übermittlung nachvollziehbar dokumentieren

### English reference version

#### Hero headline

**E-invoices from your existing ERP—preflighted for the actual recipient.**

#### Hero subheadline

FakturaPass transforms existing invoice data into XRechnung or ZUGFeRD, checks official and known customer-specific requirements, and shows actionable corrections before preventable recipient failures occur.

#### Call to action

**Request an invoice acceptance audit**

## 12. Paid audit message

### Offer name

**FakturaPass Rechnungsannahme-Check**  
English reference: **FakturaPass Invoice Acceptance Audit**

### Short description

We analyze a representative ERP export, recent invoices, rejection messages, and requirements from up to five important recipients. The customer receives a rejection-risk report, a tested mapping assessment, prioritized corrections, and a bounded production recommendation.

### What it validates commercially

- whether the problem is painful enough to pay for;
- whether a reusable mapping exists;
- which recipient profiles matter first;
- who owns the budget and implementation;
- whether FakturaPass can lead to a recurring subscription.

### Initial price hypothesis

€500–€1,500, credited toward onboarding if the customer proceeds to a pilot.

This is a discovery hypothesis and should not be presented as a fixed public price until tested.

## 13. Role-specific messaging

### CFO or Head of Finance

**Concern:** Payment delay, deadline risk, cost, and accountability.

**Message:** Reduce preventable rejection and manual correction while preserving the current ERP investment.

**Evidence:** Failure frequency, resolution time, payment-delay examples, bounded implementation and price.

### Accounts Receivable or Billing Lead

**Concern:** Manual work and unclear rejection reasons.

**Message:** See what must be corrected before sending and track the result in one workflow.

**Evidence:** Actionable error example, recipient-rule profile, exception inbox.

### IT or Internal Software Team

**Concern:** Changing standards, unstable integrations, and support ownership.

**Message:** Integrate once with a stable contract while FakturaPass versions generation, validation, and recipient rules.

**Evidence:** Canonical schema, sandbox, API/export examples, versioned rules, observability.

### ERP Consultant

**Concern:** Repeating custom work for every customer and owning compliance maintenance.

**Message:** Reuse mappings, tests, and recipient rules across clients while retaining implementation and advisory value.

**Evidence:** Partner console concept, reusable recipes, responsibilities, recurring revenue model.

## 14. Common objections and responses

### “Our ERP vendor says it will support e-invoicing.”

That may solve format generation. The discovery question is whether it also supports your actual exports, recipient-specific references, delivery channels, actionable rejection handling, and evidence. If it does, FakturaPass may not be needed.

### “A validator is available for free.”

Free validation is useful and should be used where appropriate. FakturaPass is intended to connect validation to the source data, recipient requirements, correction workflow, and delivery result.

### “We can send XRechnung by email ourselves.”

Email may be sufficient for many German B2B cases. FakturaPass should not sell a network where one is unnecessary. The value is reliable generation, preflight, remediation, and traceability; delivery options should match the recipient.

### “We only have a few rejections.”

Then the customer may not be a strong fit. The audit should quantify frequency, staff time, payment impact, and upcoming requirements before proposing software.

### “Can you guarantee acceptance?”

No provider can guarantee that a buyer will process or pay every invoice. FakturaPass can validate against applicable standards and known recipient requirements, reduce preventable errors, and document the delivery path.

### “Can we upload PDFs and convert them automatically?”

Assisted PDF migration can be supported, but extracted data must be reviewed where confidence or authoritative values are uncertain. FakturaPass should not silently invent tax, identifier, date, or monetary data.

### “Do you replace DATEV or our accounting system?”

No. FakturaPass is intended as an integration and preflight layer around the existing source system, not as complete bookkeeping, banking, payroll, or accounts-payable software.

## 15. Claims policy

### Claims we can make carefully

- FakturaPass is designed to preserve the existing ERP.
- It is designed to generate and validate supported structured invoice formats.
- It checks configured, known recipient requirements.
- It explains detected problems and records validation and delivery evidence.
- It aims to reduce preventable rejections and manual correction.

### Claims requiring customer evidence before publication

- percentage reduction in rejection rate;
- hours or euros saved;
- implementation time;
- first-pass acceptance rate;
- number of supported ERPs or recipients;
- security, uptime, or service-level performance;
- customer logos, testimonials, and case studies.

### Claims to avoid

- “Guaranteed compliant” without defining scope, rule version, and responsibility;
- “Guaranteed acceptance” or “guaranteed payment”;
- “Supports every ERP”;
- “Covers all of Europe”;
- “Fully automatic PDF conversion with no review”;
- legal or tax advice;
- describing email, Peppol, or any one channel as universally mandatory for German B2B invoicing.

## 16. Tone and language

FakturaPass should sound:

- precise, calm, and operational;
- technically credible without overwhelming finance users;
- honest about scope and uncertainty;
- focused on preserving systems and reducing disruption;
- German-market aware rather than generically “European.”

Avoid:

- compliance fearmongering;
- unexplained acronyms in primary messaging;
- claims that regulation alone guarantees demand;
- fashionable AI language where deterministic rules matter;
- implying that customers have failed by keeping an older ERP.

## 17. Naming rationale

“FakturaPass” suggests an invoice passing through checks and reaching a processable state. It is short and usable across several European languages.

The name should not be interpreted as a legal certification mark or unconditional “pass.” Product copy should describe a documented preflight result against a defined set of rules.

Before public launch, complete formal domain, company-name, and trademark clearance in Germany and relevant EU classes.

## 18. Message tests for interviews

Test these variants without asking which slogan the participant “likes.” Ask what they believe the product does, who it is for, and whether it connects to a recent problem.

### Variant A: ERP preservation

> Add compliant e-invoicing to your existing ERP without replacing it.

### Variant B: Recipient acceptance

> Catch customer-specific invoice problems before they become rejections.

### Variant C: Operational evidence

> Know what was generated, which rules were checked, and what the recipient returned.

### Variant D: Partner reuse

> Reuse e-invoice mappings and recipient rules across your ERP customers.

Record which message produces concrete examples, artifact sharing, or buying engagement. Do not select a message from verbal preference alone.

## 19. Positioning validation criteria

Keep the current positioning if:

- prospects immediately understand that FakturaPass works with the existing ERP;
- qualified prospects describe recent recipient-specific or mapping failures;
- the phrase “recipient-aware preflight” can be explained in plain language;
- customers value actionable correction and evidence beyond generic conversion;
- paid audit interest comes from the target segment.

Revise it if:

- prospects consistently interpret FakturaPass as accounting software;
- ERP preservation is not an important buying reason;
- recipient-specific failure is rare;
- the urgent problem is inbound processing rather than outbound acceptance;
- a narrower vertical, ERP, or delivery channel produces much stronger commitments.

## 20. Current recommended message set

**Category:** Recipient-aware e-invoice bridge for existing ERP systems  
**Primary promise:** Keep your ERP. Send e-invoices your customers can actually process.  
**German headline:** E-Rechnungen aus Ihrem bestehenden ERP—geprüft für den tatsächlichen Empfänger.  
**Primary offer:** FakturaPass Rechnungsannahme-Check  
**Primary proof objective:** Demonstrate fewer preventable rejections through a real export, named recipient rules, actionable corrections, and traceable results.

