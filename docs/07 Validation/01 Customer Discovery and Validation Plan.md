# FakturaPass Customer Discovery and Validation Plan

**Status:** Working plan  
**Iteration:** 1  
**Primary market:** Germany  
**Purpose:** Decide whether FakturaPass should be built, for whom, and around which recurring workflow.

## 1. Decision to be made

The discovery process must answer one practical question:

> Will German suppliers with legacy, customized, or internally built billing systems pay for a recipient-aware e-invoice bridge that reduces preventable rejections without forcing an ERP replacement?

This is not a general survey about whether e-invoicing is important. Regulation already establishes importance. We need evidence that a narrow, repeated, expensive problem exists and that FakturaPass can solve it with a reusable product rather than open-ended consulting.

## 2. Current hypothesis

FakturaPass connects to an existing ERP or billing export, maps invoice data into a canonical model, produces compliant XRechnung or ZUGFeRD output, validates it, applies recipient-specific requirements, and returns a traceable delivery result.

The differentiated promise is not simply “valid XML.” It is:

> Keep your ERP. Send invoices your customers can actually process.

The strongest suspected pain is the gap between standards compliance and successful recipient acceptance. Examples include missing purchase-order references, incorrect buyer identifiers, unsupported syntax or version, attachment policies, filename conventions, routing fields, and customer-specific delivery channels.

## 3. Assumptions to test

### Problem assumptions

1. Target suppliers experience repeated invoice rejection, manual correction, or delayed payment because of recipient-specific requirements.
2. The work is operationally expensive enough to attract budget, not merely annoying.
3. Existing ERP upgrades, accounting suites, generic validators, and customer portals do not solve the entire workflow.
4. The problem recurs across invoices and customers rather than appearing only as isolated edge cases.
5. Finance teams can provide real artifacts such as anonymized exports, rejection messages, and buyer instructions.

### Customer assumptions

1. The first viable segment is German suppliers with approximately 5–200 employees.
2. They send roughly 50–5,000 outbound invoices per month.
3. They use a legacy, customized, vertical, or internally built ERP or billing application.
4. Their customers include public bodies or larger enterprises with strict invoice rules.
5. The economic buyer is likely a finance leader, managing director, operations leader, or IT owner—not necessarily the person manually correcting invoices.

### Solution assumptions

1. CSV, JSON, SFTP, email, or a lightweight REST API can cover a meaningful first set of source systems.
2. XRechnung UBL and ZUGFeRD EN 16931 are sufficient initial outputs.
3. Recipient-aware preflight and actionable remediation are more valuable than basic format conversion.
4. A partly manual concierge service can deliver the first outcome before a complete SaaS product exists.
5. A small library of reusable mappings and recipient profiles can compound across customers.

### Commercial assumptions

1. A qualified prospect will pay €500–€1,500 for a fixed-scope invoice acceptance audit.
2. A recurring service can support a starting price near €149–€399 per month, plus onboarding.
3. ERP implementers and specialized IT consultants can become a scalable acquisition channel.
4. Customers will pay for reduced rejection risk, implementation effort, evidence, and exception handling—not for XML generation alone.

## 4. Target interview groups

Interview across the workflow so that conclusions do not depend on one role's perception.

### Group A: Supplier finance and accounts receivable — 12 interviews

Prioritize organizations that:

- have 5–200 employees;
- issue at least 50 B2B invoices per month;
- sell to public bodies or large enterprises;
- use a non-standard or heavily customized billing system;
- have already attempted structured e-invoicing.

Relevant roles include Head of Finance, Finance Manager, Accounts Receivable Lead, CFO, Managing Director, and Billing Operations Lead.

### Group B: ERP consultants and managed IT providers — 8 interviews

Seek consultants supporting older German mid-market systems, vertical ERPs, Microsoft Dynamics installations, Sage, abas, custom Warenwirtschaft, and internally developed billing applications.

These interviews test whether integration patterns repeat and whether consultants would introduce, implement, or resell FakturaPass.

### Group C: Tax advisers and accounting professionals — 5 interviews

Use these interviews to understand customer readiness, recurring misconceptions, referral potential, and the boundary between technical validation and tax or legal advice.

### Group D: Invoice recipients — 5 interviews

Interview accounts-payable or procurement staff at large buyers and public bodies. Explore rejection reasons, rule publication, feedback quality, preferred delivery channels, and whether supplier-facing validation could reduce their own support burden.

## 5. Recruiting strategy

Build an initial prospect list of 80–120 organizations and contacts.

Sources:

- existing professional network;
- ERP implementation partners and regional IT service providers;
- suppliers listed in public procurement awards;
- companies publishing XRechnung or supplier-invoice instructions;
- German industry associations and regional business networks;
- LinkedIn searches for finance, billing, ERP, and accounts-receivable roles;
- companies recruiting for invoice integration or ERP modernization work;
- referrals requested at the end of every interview.

Use a short, non-sales outreach message:

> I am researching how German suppliers using existing ERP and billing systems are handling structured e-invoices and customer-specific rejection rules. I am not selling software in this conversation. I would value 30 minutes to understand your current process, recent failures, and what you have already tried. I can share an anonymized summary of the findings afterward.

Do not lead with product features. Recruit around the workflow and the problem.

## 6. Interview method

### Before each interview

- Research the company, customer types, and likely ERP environment.
- Record the participant's role and whether they are a user, influencer, technical owner, or buyer.
- Prepare no more than three company-specific follow-up questions.
- Ask permission to take notes and request anonymized artifacts.

### Core interview questions

#### Current process

1. Walk me through the last invoice you sent to a public body or large enterprise—from the billing system to acceptance or payment.
2. Which systems, exports, portals, email inboxes, and people were involved?
3. Which structured formats and delivery channels do you currently support?
4. What remains manual?

#### Recent problems

5. Tell me about the most recent invoice that was rejected, returned, or delayed.
6. What was the exact reason, and how did you discover it?
7. Who investigated and corrected it? How long did that take?
8. How often does a similar problem occur?
9. What financial or operational consequence followed?

#### Existing alternatives

10. What have you already tried: ERP update, accounting software, validator, converter, portal, consultant, or custom integration?
11. What does the current solution handle well?
12. Where does it still fail or require manual work?
13. Why have you not replaced the ERP or billing system?

#### Recipient-specific requirements

14. Which customer requirements go beyond producing technically valid XRechnung or ZUGFeRD?
15. Where are those requirements documented?
16. How do you keep them current, and who owns that work?
17. Do different customers require different identifiers, references, attachments, syntax versions, filenames, or channels?

#### Buying process

18. Who owns this problem and who can approve spending?
19. Is there an active deadline, project, budget, or customer escalation?
20. What would a successful solution need to prove before production use?
21. What security, hosting, contractual, or integration requirements would block adoption?

#### Commitment test

22. Would you share anonymized invoice exports, rejection messages, or recipient instructions for analysis?
23. If a fixed-scope audit identified rejection risks and produced a tested implementation path, would you consider paying €500–€1,500?
24. Who else should we speak with?

### Questions to avoid

Avoid asking:

- “Do you like this idea?”
- “Would you use an e-invoicing platform?”
- “Would AI help?”
- “How much would you pay?” without a concrete offer and scope.

Opinions and compliments are weak evidence. Prior behavior, artifacts, allocated budget, introductions, and payments are strong evidence.

## 7. Evidence to collect

With permission and appropriate anonymization, request:

- sample ERP exports in CSV, JSON, XML, or PDF;
- accepted and rejected structured invoices;
- rejection emails and portal messages;
- recipient onboarding guides and supplier rulebooks;
- screenshots of manual correction steps;
- internal mapping spreadsheets;
- invoice volumes by format and recipient;
- time spent resolving failures;
- implementation proposals or quotations from current vendors;
- names of systems and delivery channels involved.

Never request live credentials, private keys, production tokens, or unredacted personal and financial data during discovery.

## 8. Evidence scoring

Score each interview from 0–2 on the following dimensions:

| Dimension | 0 | 1 | 2 |
|---|---|---|---|
| Frequency | Rare or hypothetical | Occasional | Repeated monthly or more |
| Severity | Minor inconvenience | Material manual work | Delayed cash, customer escalation, or compliance risk |
| Existing solution gap | Already solved | Partial workaround | No reliable solution |
| Repeatability | Unique case | Some common patterns | Clear recurring mapping or recipient pattern |
| Artifact access | None | Description or screenshot | Anonymized source files and failure evidence |
| Urgency | No timeline | General 2027/2028 concern | Active project, deadline, or escalation |
| Buying intent | Polite interest | Follow-up agreed | Paid audit, LOI, or budget owner engaged |

Maximum score: 14.

- **10–14:** strong design-partner candidate;
- **6–9:** useful learning prospect;
- **0–5:** low priority unless the interview reveals a new segment.

## 9. Validation thresholds

Continue toward a focused MVP only if, after approximately 20–30 interviews:

1. At least 10 qualified supplier prospects report repeated recipient-specific or ERP-mapping failures.
2. At least 5 prospects share real, anonymized artifacts.
3. The same source-system, export, or recipient-rule pattern appears in at least 3 organizations.
4. At least 3 prospects agree to a paid acceptance audit, letter of intent, or equivalent concrete commitment.
5. At least 1 prospect pays for the audit or a concierge pilot.
6. The expected recurring value is at least €150 per month for the narrow segment.
7. The initial outcome can be delivered through a bounded integration pattern rather than unlimited custom development.

## 10. Kill or reposition criteria

Pause or materially reposition FakturaPass if:

- most prospects can solve the full problem through a routine ERP update at negligible cost;
- invoice rejection is rare and has little measurable consequence;
- requirements are entirely customer-specific with no reusable mappings or rules;
- prospects only want a one-time converter before migrating systems;
- no qualified prospect will share artifacts or pay for a scoped audit;
- procurement and security requirements make the initial segment uneconomic;
- the actual urgent problem is inbound invoice processing rather than outbound acceptance.

Repositioning is a successful discovery outcome if evidence points to a stronger adjacent problem.

## 11. Four-week execution plan

### Week 1: Recruit and calibrate

- Build the initial target list.
- Send 40 personalized outreach messages.
- Conduct 4–5 interviews.
- Refine questions based on confusing or weak responses.
- Establish anonymization and artifact-handling rules.

### Week 2: Expand and collect evidence

- Send another 40–60 outreach messages.
- Conduct 6–8 interviews.
- Request artifacts from strong prospects.
- Begin grouping pains by source system, recipient, and failure type.

### Week 3: Test the offer

- Conduct 6–8 interviews.
- Present the fixed-scope acceptance audit only after confirming pain.
- Ask strong candidates for a paid commitment, LOI, or introduction to the buyer.
- Draft the first reusable source mapping and recipient profile from real evidence.

### Week 4: Decide

- Complete remaining interviews.
- Score all evidence consistently.
- Identify the narrowest repeated problem.
- Select up to three design partners.
- Decide: proceed, narrow, reposition, or stop.
- Write a one-page evidence summary before drafting the MVP PRD.

## 12. Outputs from this iteration

At the end of discovery, produce:

1. a ranked list of validated problems;
2. a revised ideal customer profile;
3. an artifact inventory and anonymized test corpus;
4. a decision on the first supported input and output path;
5. a shortlist of initial recipient profiles;
6. paid-audit or pilot commitments;
7. a documented proceed, reposition, or stop decision.

## 13. Operating rules

- Record interviews within 24 hours.
- Separate direct quotes and observed facts from interpretation.
- Never count compliments as validation.
- Track contradictory evidence, not only supporting evidence.
- Do not build a broad product during the interview phase.
- Treat customer artifacts as confidential even when anonymized.
- Update the hypothesis only after a repeated pattern, not after one dramatic interview.

