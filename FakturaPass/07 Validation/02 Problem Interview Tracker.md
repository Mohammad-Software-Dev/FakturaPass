# FakturaPass Problem Interview Tracker

**Purpose:** Capture comparable evidence from discovery interviews and identify repeated, payable problems.  
**Usage:** Duplicate the interview record section for every conversation. Update the roll-up tables weekly.

## 1. Interview pipeline

| ID | Company | Segment | Contact role | Source | Status | Interview date | Score / 14 | Artifact shared | Paid-audit signal | Next action |
|---|---|---|---|---|---|---|---:|---|---|---|
| FP-001 |  | Supplier / ERP partner / Adviser / Recipient |  |  | Identified |  |  | No | None |  |
| FP-002 |  |  |  |  | Identified |  |  | No | None |  |
| FP-003 |  |  |  |  | Identified |  |  | No | None |  |

Suggested statuses: `Identified`, `Contacted`, `Scheduled`, `Interviewed`, `Evidence received`, `Audit proposed`, `Committed`, `Not a fit`.

## 2. Interview record template

### Interview FP-___

#### Administrative details

| Field | Value |
|---|---|
| Company |  |
| Website |  |
| Industry |  |
| Employee range |  |
| Interviewee |  |
| Role |  |
| Role in purchase | User / Technical owner / Influencer / Buyer / Approver |
| Interview date |  |
| Interviewer |  |
| Referral source |  |
| Permission to recontact | Yes / No |

#### Qualification

| Field | Value |
|---|---|
| Outbound B2B invoices per month |  |
| Public-sector or enterprise customers |  |
| ERP or billing system |  |
| Degree of customization | Standard / Configured / Heavily customized / Internally built |
| Current invoice outputs | PDF / XRechnung UBL / XRechnung CII / ZUGFeRD / Other |
| Delivery channels | Email / Portal / Peppol / API / SFTP / Other |
| E-invoicing owner |  |
| Active deadline or project |  |

#### Current workflow

Document the actual sequence, including systems and people:

1. Invoice originates in:
2. Data is exported or transferred as:
3. Conversion or generation happens in:
4. Validation happens in:
5. Delivery happens through:
6. Acceptance or rejection is detected through:
7. Corrections are performed by:
8. Evidence and originals are stored in:

#### Most recent failure

| Field | Notes |
|---|---|
| What happened? |  |
| When did it happen? |  |
| Recipient involved |  |
| Format and channel |  |
| Exact rejection or delay reason |  |
| How was the issue discovered? |  |
| People involved in diagnosis |  |
| Time to resolve |  |
| Invoice value or cash-flow impact |  |
| Customer escalation or relationship impact |  |
| Could the same failure recur? |  |

#### Recipient-specific requirements observed

Mark all that apply and record the evidence.

- [ ] Buyer reference
- [ ] Purchase-order number or pattern
- [ ] Supplier identifier
- [ ] Contract or project reference
- [ ] Cost center or routing value
- [ ] Accepted syntax or format version
- [ ] Required or prohibited attachments
- [ ] Filename convention
- [ ] Delivery channel
- [ ] Portal-specific entry
- [ ] Tax or rounding rule
- [ ] Customer-specific validation rule
- [ ] Other:

Evidence or source of the requirement:

#### Existing solution and alternatives

| Question | Notes |
|---|---|
| What solution is currently used? |  |
| What does it solve well? |  |
| What remains manual or unreliable? |  |
| What alternatives were evaluated? |  |
| Why was the ERP not replaced or upgraded? |  |
| Current implementation or subscription cost |  |
| Switching barriers |  |

#### Measurable impact

| Metric | Estimate | Confidence |
|---|---:|---|
| Rejections or corrections per month |  | Low / Medium / High |
| Minutes per correction |  | Low / Medium / High |
| Monthly staff time |  | Low / Medium / High |
| Typical payment delay |  | Low / Medium / High |
| External consultant cost |  | Low / Medium / High |
| Customers with unique invoice rules |  | Low / Medium / High |

#### Buying process

| Field | Notes |
|---|---|
| Operational owner |  |
| Budget owner |  |
| Technical approver |  |
| Security or compliance approver |  |
| Procurement process |  |
| Available budget |  |
| Desired implementation date |  |
| Required proof before purchase |  |
| Main adoption blocker |  |

#### Commitment evidence

- [ ] Agreed to a follow-up meeting
- [ ] Introduced another stakeholder
- [ ] Shared anonymized artifacts
- [ ] Allowed use of artifacts in a private test corpus
- [ ] Requested a proposal
- [ ] Agreed to a paid acceptance audit
- [ ] Signed an LOI
- [ ] Paid for an audit or pilot

Details:

#### Evidence score

| Dimension | Score 0–2 | Reason |
|---|---:|---|
| Frequency |  |  |
| Severity |  |  |
| Existing solution gap |  |  |
| Repeatability |  |  |
| Artifact access |  |  |
| Urgency |  |  |
| Buying intent |  |  |
| **Total** | **/14** |  |

Scoring guide:

- **Frequency:** 0 rare or hypothetical; 1 occasional; 2 repeated monthly or more.
- **Severity:** 0 minor; 1 material manual work; 2 delayed cash, escalation, or compliance exposure.
- **Existing solution gap:** 0 solved; 1 partial workaround; 2 no reliable solution.
- **Repeatability:** 0 unique; 1 some commonality; 2 clear recurring pattern.
- **Artifact access:** 0 none; 1 description or screenshot; 2 anonymized source files and evidence.
- **Urgency:** 0 none; 1 general concern; 2 active deadline, project, or escalation.
- **Buying intent:** 0 polite interest; 1 concrete follow-up; 2 paid audit, LOI, or budget owner engaged.

#### Interpretation

**Facts observed:**

- 

**Direct quotes:**

- “ ”

**Our interpretation:**

- 

**Evidence contradicting the current FakturaPass hypothesis:**

- 

**Recommended next action:**

- 

## 3. Artifact register

Do not store unredacted customer documents in this tracker. Record where approved, anonymized material is held.

| Artifact ID | Interview ID | Type | Source system or recipient | Anonymized | Permission recorded | Storage location | Useful for |
|---|---|---|---|---|---|---|---|
| ART-001 |  | ERP export / Rejected invoice / Rulebook / Error message / Screenshot |  |  |  |  | Mapping / Recipient profile / Test case |

Never collect credentials, private keys, production tokens, or unnecessary personal data.

## 4. Weekly pattern roll-up

### Problems by frequency and severity

| Problem pattern | Interviews mentioning it | Strong artifacts | Average severity | Reusable across companies? | Potential product response |
|---|---:|---:|---:|---|---|
| Missing or invalid buyer/PO reference |  |  |  |  | Recipient-aware preflight |
| ERP export lacks required fields |  |  |  |  | Mapping and enrichment workflow |
| Accepted syntax or version differs by recipient |  |  |  |  | Recipient profile |
| Delivery status is unclear |  |  |  |  | Delivery evidence and acknowledgements |
| Rejection feedback is hard to interpret |  |  |  |  | Actionable remediation |
| PDF-to-structured migration requires review |  |  |  |  | Assisted migration mode |

### Source-system patterns

| ERP or export pattern | Number of prospects | Example fields available | Missing fields | Integration difficulty | Candidate for first connector |
|---|---:|---|---|---|---|
| CSV export |  |  |  |  |  |
| JSON/API |  |  |  |  |  |
| SFTP batch |  |  |  |  |  |

### Recipient patterns

| Recipient or recipient type | Number of suppliers affected | Rules publicly documented | Frequent failures | Profile candidate |
|---|---:|---|---|---|
| German public body |  |  |  |  |
| Large industrial buyer |  |  |  |  |
| Enterprise shared-service center |  |  |  |  |

### Commercial signals

| Signal | Count | Target threshold |
|---|---:|---:|
| Qualified supplier interviews | 0 | 12+ |
| ERP partner interviews | 0 | 8+ |
| Recipient/adviser interviews | 0 | 10+ |
| Prospects reporting repeated failures | 0 | 10+ |
| Prospects sharing artifacts | 0 | 5+ |
| Repeated integration or rule pattern | 0 | 3 organizations |
| Paid audit or LOI commitments | 0 | 3+ |
| Paying audit or pilot customers | 0 | 1+ |

## 5. Decision log

| Date | Evidence reviewed | Decision | Why | What would reverse it |
|---|---|---|---|---|
|  |  |  |  |  |

## 6. Final discovery decision

Complete this only after the agreed interview window.

**Decision:** Proceed / Narrow / Reposition / Stop

**Validated customer segment:**

**Validated recurring problem:**

**First supported input path:**

**First supported output and delivery path:**

**Evidence of willingness to pay:**

**Unresolved risks:**

**Next document to create:** Revised ICP / Paid Acceptance Audit Offer / MVP PRD / Other

