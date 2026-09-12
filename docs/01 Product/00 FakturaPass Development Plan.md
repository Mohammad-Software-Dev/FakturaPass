# FakturaPass — Development Plan

**Version:** 1.0  
**Prepared:** 11 September 2026  
**Status:** Implementation-ready proposal; customer demand and provider choices remain unvalidated.  
**Product owner:** Founder  
**Technical owner:** Lead engineer, with implementation assistance  
**Planning assumption:** One experienced full-time engineer, founder available for weekly decisions and customer work, and part-time domain/security review. Estimates are planning ranges, not delivery commitments.

## 1. Product decision

Build a German outbound e-invoice bridge for companies that want to retain their existing ERP. FakturaPass will ingest a repeatable export, produce a supported structured invoice, validate official rules and known recipient requirements, explain corrections in source-field terms, and preserve a traceable result.

The first end-to-end product journey is:

> Upload an ERP CSV or submit JSON → select a saved mapping and recipient → identify missing or invalid data → correct and approve a revision → generate validated XRechnung UBL → download or send through an approved channel → inspect delivery evidence and recipient feedback.

**First customer:** A German supplier with 20–200 employees, 200–5,000 outbound invoices monthly, a legacy/custom/vertical billing system, and demanding enterprise or public-sector recipients. This adopts the newer ICP and messaging documents over the wider ranges in the opportunity paper.

**Final product for this plan:** A sellable, operated German SaaS v1 supporting CSV/JSON/API ingestion, reusable mappings, XRechnung UBL and ZUGFeRD EN 16931 output, versioned recipient preflight, exception handling, download/API return and email delivery, evidence export, tenant administration, billing, and production operations. SFTP and a certified Peppol partner are conditional extensions. European expansion is a later program, not a condition for completing v1.

Start the technical foundation immediately using synthetic fixtures. Continue discovery alongside it. Real customer evidence determines the first production mappings, recipients, and transport; it does not need to delay a bounded local pipeline.

## 2. What was reviewed and what is missing

Reviewed all six documents found in the supplied folder and its `01 Validation` subfolder. No application source code, completed customer interviews, real export corpus, signed pilot commitments, or production architecture was present in those reviewed materials. The local workspace contains an opportunity Markdown document and Git metadata, but no application implementation was observed.

| Source | Decision carried into this plan |
|---|---|
| [Opportunity paper](https://docs.google.com/document/d/1HeDOXXZsv2QGE7bgCbZCzOCe-y3I5k1zwCeg32jo_K8/edit) | ERP bridge, recipient rules, deterministic core, versioned evidence, Germany first |
| [Customer Discovery and Validation Plan](https://drive.google.com/file/d/14igIKB95-ekCCNwjcgFqikMqiW33YS2P/view) | Validate repeated pain, artifact access, willingness to pay, and reusable patterns |
| [Problem Interview Tracker](https://drive.google.com/file/d/1u0HYHq626twqENeff1f-sTyAdbcBWKXr/view) | Commercial counters are still zero; do not describe assumptions as validated |
| [Initial Ideal Customer Profile](https://drive.google.com/file/d/1h7xNGJJ6-gRvqLhghwETfrbt-JQyr7hr/view) | Primary segment narrowed to 20–200 employees and 200–5,000 invoices/month |
| [Positioning and Messaging Brief](https://drive.google.com/file/d/1kQDaxr6Jc6ArV1PLC5NviDvXW8jbPL44/view) | Finance-friendly corrections and traceability; no guarantee of acceptance or payment |
| [Paid Invoice Acceptance Audit Offer](https://drive.google.com/file/d/1qSFaDjtSOVK-0FWgpZlawRheNA57odDZ/view) | One entity/export, up to 50 records and five recipients; bounded paid onboarding |

### Draft assessment

The draft has a coherent product wedge and a useful commercial validation package. Its main development gap is that feature ideas are not yet expressed as supported cases, data contracts, state transitions, dependencies, or measurable release gates. This plan supplies those details.

Resolve these inconsistencies explicitly:

- Use **FakturaPass** as the working name. The local opportunity copy still uses InvoiceGate in places; Drive's newer branding takes precedence.
- Keep the interview score `/14`, ICP score `/20`, and audit score `/16` separate and named. They measure different decisions and must not share one unlabeled qualification field.
- Treat prices as hypotheses. Use €1,000 plus VAT as the standard audit test and €500–€1,000 for tightly scoped founding audits, consistent with the audit document. Do not hardcode these into the application.
- Treat the original 90-day schedule as a prototype/pilot ambition. A complete supported SaaS requires security, billing, recovery, and operating work beyond the demo.
- Make manual invoice entry and assisted PDF conversion post-v1 acquisition features. They must not displace the ERP bridge during the first build.

## 3. Release boundaries and supported cases

### Release A — Technical demonstrator, target weeks 1–4

- Synthetic data only; locally runnable and repeatable in CI.
- Canonical invoice contract, JSON ingestion, deterministic decimal arithmetic.
- XRechnung UBL generation and pinned KoSIT validation.
- Source-linked errors, basic invoice preview and a downloadable evidence bundle.
- Three clearly labeled synthetic recipient profiles. No real recipient claim without verified instructions.
- No live invoice sending; demo success is not a compliance or market-validation claim.

### Release B — Controlled paid pilot, target weeks 5–10

- Up to three onboarded customer tenants; one issuing entity and one export pattern per customer.
- CSV mapping recipes configured internally, plus JSON API.
- Ordinary domestic German EUR invoices; credit notes added before any pilot uses automated corrections of issued invoices.
- Explicit standard/reduced VAT rates, mixed-rate breakdowns, decimal quantities, line/document allowances and charges, payment terms, buyer/PO references, and bounded attachments.
- Customer supplies tax category/rate and authoritative amounts. FakturaPass checks consistency; it does not decide tax treatment.
- Versioned recipient profiles, review queue, revision approvals, evidence export, scoped roles, and download/API return.
- Email sending only after transport controls and the customer's exact recipient route pass acceptance tests.
- ZUGFeRD is not promised in the first pilot unless its complete output/validation gate has passed.

### Release C — German commercial SaaS v1, target weeks 11–18

- All core pilot capabilities hardened and documented.
- ZUGFeRD EN 16931 with validated PDF/A-3, extracted XML verification, and visible/structured-data consistency checks.
- Safe mapping editor, versioned recipes, sandbox credentials, signed webhooks, usage ledger, paid plans and invoices through a billing provider.
- Admin, finance operator, approver, and read-only roles; audited support access.
- German interface and business error explanations; English API documentation and stable machine error codes.
- Production deployment, monitoring, backups, restore drill, retention/export workflow, support procedures, and external security review.
- At least five sourced recipient profiles or tenant-specific verified profiles covering the pilot's actual recipients; prioritize coverage over a marketing count.

### Cases explicitly blocked until separately tested

Reverse charge, exempt/Kleinunternehmer cases, intra-EU and export transactions, self-billing, foreign currencies, installments/progress/final construction invoices, retentions, and sector extensions. The data model should represent extensible tax categories and references, but an enum is not a promise of support. Unsupported combinations return a specific error and never proceed to delivery. Promote cases individually with domain review and representative fixtures.

### Conditional extensions after the core works

| Extension | Trigger and scope | Indicative additional effort |
|---|---|---|
| SFTP | A committed customer requires unattended batches; one inbound adapter with key rotation, host verification, atomic arrival, deduplication, quarantine, and result files | 1–2 engineer-weeks |
| Peppol via partner | A pilot's actual buyer requires it; certified partner, identity/onboarding, discovery, sandbox, submission and acknowledgement mapping | 2–4 engineer-weeks plus provider lead time |
| Multi-entity/partner console | Several paying customers need delegated multi-client operation; explicit scoped grants and cross-client isolation tests | 2–4 engineer-weeks |
| Assisted PDF migration | Demand justifies extraction/review costs; customer confirmation of authoritative values and deterministic final generation | 3–5 engineer-weeks |
| Manual entry/free preflight | Acquisition evidence supports it; quotas, abuse controls, separate short retention, reusable core pipeline | 1–3 engineer-weeks |
| Additional country | Paid demand, jurisdiction-specific requirements inventory, local review and delivery/reporting partner | Separate estimate and country release gate |

These estimates are additive when one engineer implements them. If a mandatory channel enters the pilot scope, move other work or move the date.

Exclude bookkeeping, bank feeds, payment execution, CRM, payroll, general accounts-payable automation, universal ERP connectors, a proprietary Peppol access point, and claims of certified legal archiving.

## 4. User experience and acceptance scenarios

### Essential screens

1. **Organization setup:** company identifiers, address, verified sending configuration, archive/export destination, user invitations, sandbox/production distinction.
2. **Invoices:** searchable list by source ID, recipient, date, processing status, delivery result and review owner; batch summary without hiding per-invoice failures.
3. **Import:** upload/JSON example, mapping selection, dry-run preview, row-level errors, explicit commit; do not silently merge invoices.
4. **Invoice workspace:** source values, normalized preview, separate standards/recipient checks, corrections, approval, download/send, immutable history.
5. **Review queue:** missing data, unverified rules, changed master data, failed jobs, uncertain sends and recipient rejections, each with a responsible person.
6. **Recipients:** identifiers, accepted format/channel, sourced requirements, review status, tenant overrides and version history.
7. **Mappings:** sample-driven field mapping with safe transformations and draft/test/publish lifecycle.
8. **Integrations and settings:** scoped API keys, webhook deliveries/retries, usage, users, evidence export and retention status.

Use keyboard-operable forms and tables, clear focus states and labels, textual error indicators, and German date/number presentation. Preserve canonical values independently of display locale.

### End-to-end acceptance scenarios

| Scenario | Required observable behavior |
|---|---|
| Valid invoice to known recipient | Correct output passes the selected rules; source/mapping/profile/engine versions and hashes appear in evidence |
| Missing required PO reference | Sending is blocked; finance sees the source column/field, requirement source and correction action |
| Invalid tax total | Show declared versus computed totals; require correction rather than silently changing the invoice |
| Duplicate API call | Same idempotency key/body returns the original resource without duplicate generation, delivery or billing |
| Correction before sending | New revision invalidates prior approval/checks; send uses only the approved immutable artifact |
| Rejection after sending | Preserve original sent revision; record feedback and link a corrected/replacement document under the agreed issuer workflow |
| Provider times out during submission | Mark submission outcome unknown; reconcile before retrying a possibly completed send |
| Email server accepts message | Display transport evidence; recipient acceptance remains unknown without separate evidence |
| No recipient profile exists | Show official results and recipient coverage as unknown; require explicit review before delivery |
| User switches tenant or guesses file ID | API, database, download and background job boundaries deny unauthorized access |
| Rule bundle changes | Old evidence remains unchanged; replay produces a separate comparison and approval before activation |
| Customer exports records | Original bytes, manifest, hashes, versions, reports and delivery events can be retrieved and verified |

## 5. Architecture and build/buy choices

Use a modular application with separately deployed background processing, not a large microservice estate.

```text
German web UI / ERP CSV / REST JSON
                |
        Authenticated application API
                |
     PostgreSQL + transactional job/outbox records
                |
          Background worker
                |
  Parse -> Map -> Check -> Generate -> Validate -> Recipient preflight
                |                              |
         Review / approval               Evidence storage
                |
       Approved artifact and route
                |
     Download/API return | Email adapter | Later Peppol adapter
                |
       Delivery events / feedback -> UI + signed webhooks
```

### Proposed stack

| Area | Default decision | Reason / confirmation task |
|---|---|---|
| Web application | TypeScript, React/Next.js, server-hosted container | One language across UI/contracts; Next.js supports Node/Docker deployment ([official docs](https://nextjs.org/docs/app/getting-started/deploying)) |
| API | Versioned REST endpoints in the application, shared domain package, OpenAPI contract | Keep UI and external ingestion on the same authorization and validation path |
| Database | Managed PostgreSQL; SQL migrations and typed access | Transactions for revisions, deduplication, approvals, events and usage |
| Jobs | PostgreSQL-backed durable queue/outbox and separate Node worker | Avoid a second datastore initially; prove leases, crash recovery and retries |
| Invoice engine | Isolated Java container wrapping KoSIT; dedicated UBL serializer; Mustang evaluated for CII/ZUGFeRD | Separate invoice engine lifecycle from web deployment |
| Arithmetic | Decimal strings at API boundary and tested decimal arithmetic | No floating-point monetary calculations; explicit rounding per rule |
| Storage | Private object storage in Germany/EU; versioned original artifacts and restricted evidence writes | Preserve exact source/output bytes; separate temporary and retained storage |
| Identity | Established OIDC identity provider with MFA and EU-processing review | Avoid implementing password/reset security; organization permissions remain application-owned |
| Delivery | Transactional email provider behind an adapter | Verify sender domain, events, data processing, quotas and supported regions before purchase |
| Billing | Established subscription billing provider; manual pilot billing first | Delay checkout complexity until pilot value is proven |
| Hosting | Germany/EU container runtime, managed database and object storage | Supports persistent background/Java workloads and one-region initial operation |
| Testing | Unit/property tests, container integration tests, browser workflow tests, official fixtures | Verify business invariants, real engines and failure handling |
| Observability | Structured redacted logs, metrics, error reporting, trace IDs | Diagnose failures without leaking invoice payloads |

These are proposed engineering decisions, not installed or purchased services. Exact supported dependency releases, licenses, advisories and provider contracts must be checked and locked in week 1. No vendor purchase is needed to start locally.

Build recipient rules, mapping provenance, remediation, approvals and evidence as proprietary product logic. Reuse official validation artifacts; buy identity and commodity transport. Do not assume Mustang supplies the desired UBL generation API: its repository emphasizes CII/ZUGFeRD. Prove the UBL serializer independently against KoSIT. Mustang is an Apache-2.0 Java project with invoice and validator components ([repository](https://github.com/ZUGFeRD/mustangproject/)).

### Repository layout to create in the first implementation task

```text
apps/web/                  UI, authenticated REST endpoints
apps/worker/               durable invoice and delivery jobs
services/invoice-engine/   Java validation and hybrid-format adapter
packages/contracts/       invoice schema, OpenAPI, error contracts
packages/domain/          arithmetic, states, policies, recipient rules
packages/database/        migrations and tenant-scoped queries
packages/mappings/        safe transformations and provenance
fixtures/                 synthetic/public cases and expected findings
infra/                    local Compose, deployment and configuration
docs/                     support matrix, ADRs, runbooks, pilot checklists
```

Customer invoice samples belong in approved restricted storage, never in the source repository. Only suitably authorized synthetic/anonymized derivatives enter reusable fixtures.

## 6. Core contracts and data model

### Canonical invoice v1

Require schema version, source system/record ID, document type/number/date, issuing entity, seller/buyer names and addresses, electronic identifiers with scheme IDs, currency, invoice lines, quantities/units, prices, tax categories/rates, allowances/charges, tax breakdowns, totals, payment information, and applicable buyer/order/contract references. Support attachment metadata and preceding-document references where relevant.

Not every field is mandatory in every case: the schema handles structure; selected document/profile rules handle conditional requirements. Keep BT identifiers alongside canonical paths in a mapping catalog.

Use decimal strings such as `"123.45"`, ISO dates and explicit currency/unit/code-list values. Preserve identifiers as strings, including leading zeros. Do not infer missing VAT categories, bank details, dates or PO references. Save declared totals and computed checks separately. Rendering reads the same approved canonical revision as generation.

### Main records

| Record | Essential fields and invariants |
|---|---|
| Tenant / membership | Tenant ID, user ID, role, status; server-derived authorization context |
| Legal entity | Tenant ID, issuer identity and versioned master data; one active entity per pilot tenant |
| Integration / API key | Tenant/environment scope, allowed actions, hashed secret, rotation/revocation |
| Source artifact / import batch | Tenant, original object/version/hash, media type, received time, mapping version |
| Mapping version | Source schema, safe transform definitions, field provenance, sample tests, publisher |
| Invoice / revision | Stable source identity, immutable canonical snapshot, revision number, preceding/replacement linkage |
| Recipient / profile version | Tenant scope or public template, identifiers, rules, evidence source, effective/review dates |
| Generation artifact | Revision ID, syntax/profile/version, generator image digest, output hash/object version |
| Validation run / finding | Artifact hash, complete rule manifest, per-layer result, rule/path/source location, time |
| Approval | Revision and artifact hashes, validation/profile versions, route, approver/time |
| Delivery / attempt / event | Unique dispatch intent, provider ID, route snapshot, attempt number, raw evidence reference |
| Audit event | Actor, action, tenant, target revision, timestamp, trace ID and event checksum |
| Usage entry | Unique billable event, tenant, period, units, invoice reference, adjustment linkage |
| Export / retention task | Object set, manifest, customer receipt, policy, expiry/hold and deletion record |

All customer-owned rows include tenant ID. Foreign keys and uniqueness constraints include tenant scope where applicable. Scope workers, object access and cache keys as carefully as HTTP requests. Use database row security as defense in depth with a non-owner application role; table owners and privileged roles can bypass normal policies, so migrations/admin jobs need separate credentials ([PostgreSQL documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)).

### Processing and delivery state

Maintain separate dimensions:

- **Processing:** received → parsing → mapped → validating → review_required or ready; processing_error is retryable only when safe.
- **Approval:** pending → approved; any canonical, artifact, profile or route change invalidates approval.
- **Delivery:** not_requested → queued → submitting → provider_accepted → transport_delivered, bounced, failed, or outcome_unknown.
- **Recipient response:** unknown → accepted or rejected only with attributed response evidence. A person may record feedback with source and timestamp; label it manual.

Never equate generation, download, an SMTP handoff, or a network acknowledgement with business acceptance. A downloaded invoice has an export event, not a recipient delivery claim.

Invoice numbering and legally authoritative corrections remain in the ERP/customer workflow. Before issue, allow versioned corrections with actor/reason. After issue, do not mutate or quietly resend altered bytes under an old approval; require the applicable corrected-document or credit-note workflow and preserve linkage.

### Initial REST surface

| Endpoint | Behavior |
|---|---|
| `POST /v1/invoices` | Validate request envelope, persist identity/source, enqueue processing; return 202 and resource URL |
| `POST /v1/imports` | Commit an approved CSV dry run with explicit mapping/version; report per-record results |
| `GET /v1/invoices/{id}` | Revision, processing/check/approval/delivery states and links |
| `POST /v1/invoices/{id}/revisions` | New immutable normalized revision; permission and source provenance required |
| `POST /v1/invoices/{id}/validate` | New run against explicitly selected supported bundle/profile |
| `POST /v1/invoices/{id}/approve` | Optimistic concurrency check; bind approval to exact revision/artifact/route |
| `POST /v1/invoices/{id}/deliveries` | Unique dispatch intent for approved artifact; fail if approval is stale |
| `GET /v1/invoices/{id}/artifacts` | Authorized short-lived downloads of original/generated files |
| `GET /v1/invoices/{id}/evidence` | Machine-readable bundle plus human-readable report |
| `GET /v1/recipient-profiles` | Applicable verified/draft/expired profiles and versions |

Require idempotency keys on creation/dispatch endpoints. Same key and body returns the same result; same key with different body returns conflict. Also enforce source-system/record identity to detect reimports under different keys. Retain business deduplication for the configured invoice lifecycle, independent of a shorter HTTP replay cache.

Webhooks use stable event IDs, signed bodies, timestamps, retries with backoff and an operator-visible dead-letter queue. Receivers must deduplicate. Validate destinations against SSRF, including private networks and redirects. Secrets rotate; payloads contain minimal metadata and authorized retrieval links rather than whole invoices.

## 7. Mapping, validation and recipient-rule design

### Mapping

Support flat CSV with repeated header values and multiple line rows grouped by an explicit invoice key. Configure delimiter, encoding, decimal/date conventions, header names and line identity. Reject inconsistent repeated header values and ambiguous grouping.

Begin with JSON/YAML recipes maintained internally. Allowed operations: rename, trim, explicit date/decimal parse, lookup, split/concatenate, approved constant, line grouping and field selection. No arbitrary user code or unrestricted expressions. Preview transformations and preserve source file, row, column/JSON path and applied operations for each canonical value.

### Layered validation result

Return separate `pass`, `fail`, `warning`, `not_applicable`, `not_checked`, or `engine_error` outcomes for file integrity, schema, EN 16931, national profile, channel, recipient and customer policy. An engine crash or missing profile cannot become a green pass. Official errors are blocking; any warning acknowledgement is explicit and recorded.

Each finding includes stable code, original rule ID, severity/layer, canonical/BT path, XML location where available, source row/column, German explanation, proposed action and evidence source. Where no exact source mapping exists, say so and link to the normalized field.

**Initial standards baseline candidate:** KoSIT's configuration release `v2026-08-31`, compatible with XRechnung 3.0, references KoSIT Validator 1.6.3 and CEN Schematron 1.3.16. This was verified on 11 September 2026; the older usage example still references January. Evaluate the released bundle in the first spike, record every contained artifact/hash, and pin the tested combination rather than following an unversioned latest URL ([official release notes](https://github.com/itplr-kosit/validator-configuration-xrechnung/releases)).

The release manifest must distinguish standard version, configuration release, schema/Schematron/code-list versions, engine version, generator version and image digest. Future bundles enter shadow regression first. Publish a difference report, approve activation, keep a rollback path, and preserve historical reports. Recipient/channel support may require a different supported bundle; resolve compatibility explicitly before generation.

### Recipient rules

Implement a bounded declarative rule engine: required fields, safe pattern matching, allowed values, conditional requirements, syntax/version/channel restrictions, file names, attachment counts/types/sizes and identifier schemes. Bound regex complexity and execution time.

Each rule records source URL or restricted document ID, source date, reviewer, review/expiry date, applicability and status. Public profiles are templates; private contract instructions become tenant-scoped overlays. Official blocking rules cannot be weakened by a tenant override. A conflicting or expired recipient rule requires review; it never silently disappears.

Aim for 5–10 reusable rule types first, then verified profiles for actual pilot recipients. Rule count and recipient count are distinct. Assign the founder/domain reviewer to recipient evidence and an engineer to executable regression fixtures.

## 8. Evidence, security and operational controls

### Evidence and retention

Every processed revision must link original input, normalized snapshot, generated bytes, validation reports, rule/profile/mapping versions, approvals, delivery attempts, responses and an export manifest with SHA-256 hashes.

Use append-only application permissions and versioned object storage, with a separately controlled retention mechanism. Hashes support integrity verification but do not alone create immutable storage. Evaluate object lock with a reviewed retention policy; S3 Object Lock uses versioning and retention/legal-hold controls, and compliance-mode retention can prevent deletion even by privileged users ([AWS documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html)). Do not turn on irreversible long retention for all temporary uploads.

BMF guidance states an eight-year VAT invoice retention period and preservation of at least the original structured portion. That obligation must be addressed by the customer's archive or an explicitly contracted service; a short-lived SaaS evidence store is not a substitute ([BMF FAQ, question 13](https://www.bundesfinanzministerium.de/Content/DE/FAQ/e-rechnung.html)).

**Proposed operating policy, subject to contract review:** synthetic sandbox uploads expire after 7 days; audit working material after 30 days from final delivery; production working/evidence files after 90 days only where the customer has an agreed archival handoff. Before expiry, export original bytes and reports, record receipt, notify the responsible operator, and resolve failed handoff through a documented bounded exception policy. No silent deletion of the customer's only copy. Define backup expiry and legal holds consistently before live processing.

### Security acceptance requirements

- EU/German primary storage and backup locations documented, DPA/AVV and subprocessor review completed for live pilot data.
- MFA for privileged accounts; least privilege, session revocation, API key rotation, audited time-bounded support access.
- Strict XML parser settings: disable DTD/external entities and network schema resolution; use trusted bundled schemas.
- Quarantine uploads; bound file size, line count, attachments, CPU/memory/time and decompression. Treat PDF/XML rendering as untrusted and isolate it.
- Escape displayed source fields and exported spreadsheet cells; prevent active content/XSS and formula injection.
- Encrypt transport and storage; use managed secrets, private buckets, short-lived signed downloads and redacted telemetry.
- Test tenant boundaries across reads, writes, jobs, downloads, search, webhooks and exports.
- Rate limits and quotas for ingestion, validation and email; verify sender domains and approved recipient routes.
- No customer data sent to an AI service by default. Future extraction/mapping assistance needs a separate reviewed processing path and human confirmation.

### Reliability targets to validate, not advertise yet

Pilot envelope: 3 tenants × up to 5,000 invoices/month. v1 capacity test envelope: 100 tenants × 5,000/month, plus burst imports. Provisional input limits: 10 MB source upload, 1,000 invoice records per batch, 1,000 lines per invoice; attachments have separate per-channel limits. Revise from actual samples before customer commitments.

Measure ingestion separately from asynchronous processing. Targets on documented production-like hardware: API acknowledgement p95 under 1 second, processing p95 under 30 seconds for a 100-line attachment-free invoice at 10 concurrent jobs, and a 1,000-invoice batch within 30 minutes. Benchmark UBL and hybrid PDF separately. Exhausted limits return actionable errors, not partial silent success.

Proposed v1 service target: 99.5% monthly application availability, recovery point ≤1 hour and recovery time ≤4 hours. These become commitments only after funding the required infrastructure and passing failure/restore drills. Backups must include database/object consistency and retain enough evidence to reconcile sends; a restored system must not blindly replay transport jobs.

Alert on queue age, engine failures, unknown submission outcomes, bounce spikes, storage/export failures, tenant authorization anomalies and approaching capacity. Provide runbooks for provider outage, rule rollback, compromised key, failed restore, retention failure and duplicate-send investigation.

## 9. Delivery schedule and gates

Base plan: **18 weeks of active engineering**, plus **2–4 weeks contingency**. Pilot is targeted around weeks 8–10. If work starts on 14 September 2026, week 10 ends 20 November and week 18 ends 15 January 2027, before contingency and holiday availability adjustments. Do not sell an unconditional complete-v1 promise before January 2027. A narrow pilot before then is the credible objective.

| Phase | Window | Engineering deliverable | Exit gate | Primary owner |
|---|---|---|---|---|
| 0. Scope and engine spike | Week 1 | Support matrix, ADRs, canonical contract draft, UBL/KoSIT proof, synthetic valid/invalid fixtures | A valid generated invoice passes the pinned engine; known failures and engine errors are distinguishable | Lead engineer + domain reviewer |
| 1. Vertical slice | Weeks 2–4 | Repository, database, jobs, JSON ingestion, evidence, simple invoice UI and errors | Repeatable ingest → validate → review → regenerate → download path, including worker restart | Engineer |
| 2. Pilot workflow | Weeks 5–7 | Tenant/auth controls, CSV recipes, profiles, approvals, scoped API, restricted staging | Real authorized corpus mapped; isolation and stale-approval tests pass; customer archive route agreed | Engineer + founder/customer |
| 3. Controlled pilot | Weeks 8–10 | Download/API production route, then verified email, webhooks, credit notes, pilot support | Three bounded pilots targeted; correct output and known failure detection; no duplicate-send incident; commercial review | Founder + engineer |
| 4. Product completeness | Weeks 11–14 | ZUGFeRD, mapping editor, usage/billing, organization UX and documentation | Core v1 matrix passes, payment lifecycle tested, hybrid output independently checked | Engineer + reviewer |
| 5. Launch hardening | Weeks 15–18 | Load/recovery tests, security review/remediation, support and onboarding, release rehearsal | All production gates in section 12 pass; founder signs launch decision | Engineer + founder + reviewers |
| Reserve | 2–4 weeks | Integration surprises, provider approval, critical findings, leave | Absorb risk without removing safety/correctness gates | Founder |

Discovery runs in parallel during weeks 1–4 using the existing validation plan. The founder conducts/recruits interviews and sells audits; engineering time is not assumed to include 30 interviews. No outreach is sent as part of producing this document.

At week 4, evaluate the draft's thresholds: 10 prospects with repeated pain, 5 with artifacts, 3 organizations sharing a pattern, 3 concrete commitments and at least 1 paid audit/pilot, with recurring value around €150/month or more. If unmet, retain the technical demonstrator, narrow the next customer-specific build, and explicitly revisit commercial spend. Do not report a paid-pilot gate as passed just because the software works.

Critical dependency chain: supported cases → canonical contract → deterministic generation → official validation → provenance/remediation → approval/evidence → controlled transport → production operations. Mapping UI polish, free tools and reseller screens must not block this chain.

## 10. Implementation backlog

Each row is an epic to split into reviewable tasks. Estimates are focused engineer-days, include relevant automated checks, and are not additive to the phase schedule; roughly 65–95 days of core implementation overlap with review and pilot work across the schedule.

| ID | Priority / effort | Depends on | Concrete completion criteria |
|---|---|---|---|
| FP-001 | P0 / 2–3d | — | ADRs, support matrix, canonical v1 schema and fixture index committed; assumptions visible |
| FP-002 | P0 / 2–4d | FP-001 | UBL generator + KoSIT spike passes known-good case and returns raw/normalized invalid findings |
| FP-003 | P0 / 3–4d | FP-001 | Local Compose, CI, migrations, app/worker health checks, secrets template, reproducible boot |
| FP-004 | P0 / 4–5d | FP-003 | Tenant memberships, roles, scoped keys and database/object isolation proven with adversarial tests |
| FP-005 | P0 / 4–5d | FP-001–003 | Immutable source/revisions, decimal totals and source provenance; inconsistent totals remain visible |
| FP-006 | P0 / 4–5d | FP-003,005 | Durable processing jobs, idempotent ingestion, leases and crash recovery without duplicate records |
| FP-007 | P0 / 4–5d | FP-002,005,006 | Production adapter, version manifest, isolated parsing, layered findings and failed-engine handling |
| FP-008 | P0 / 4–5d | FP-005–007 | CSV dry run/grouping, saved recipe and field-linked import errors on representative exports |
| FP-009 | P0 / 3–5d | FP-005,007 | Versioned recipient rules, evidence/expiry, tenant override boundaries, pass/fail/unknown cases |
| FP-010 | P0 / 5–7d | FP-004–009 | Invoice list/workspace, review queue, revision corrections and artifact-bound approval |
| FP-011 | P0 / 3–4d | FP-005–010 | Evidence bundle verifies hashes and versions; authorized export and retention handoff work |
| FP-012 | P0 / 4–6d | FP-006,010,011 | Email adapter reconciles uncertain sends, records bounces and preserves business-response unknown |
| FP-013 | P1 / 2–3d | FP-004,006,012 | Signed webhooks, replay defense, retries, destination controls and dead-letter replay |
| FP-014 | P0 / 3–4d | FP-007,010 | Credit-note and replacement-link tests, issued-artifact immutability and support documentation |
| FP-015 | P0 / 5–7d | FP-007,010,014 | Hybrid PDF/A-3 + CII generation, profile validation, extracted-data/visible-total parity |
| FP-016 | P1 / 3–5d | FP-008,009 | Mapping editor draft/test/publish with safe transforms and failed-regression publishing block |
| FP-017 | P0 / 3–4d | FP-004,006 | Usage deduplication, plan entitlements, billing events/cancellation/failure handling; records remain exportable |
| FP-018 | P0 / 3–5d | FP-004,011,012 | Production infrastructure, backups/restore, queue/provider alerts and incident runbooks |
| FP-019 | P0 / 3–5d | FP-010–018 | German UI quality/accessibility, API guide, customer onboarding/offboarding and support matrix |
| FP-020 | P0 / 3–5d | All core | Load/recovery/security/UAT evidence, critical findings fixed, launch rehearsal and release checklist |

P0 means necessary before the release using that capability; it does not imply every P0 feature is required in week 1. Webhooks and the mapping editor may stay concierge-assisted during pilots, but are part of v1 scope.

### First ten working days

| Day | Task | Evidence at end of day |
|---|---|---|
| 1 | Write scope/support matrix and architectural decisions; inventory runtime options | Reviewed defaults and explicit excluded cases |
| 2 | Canonical schema, source identities, decimal/rounding examples, synthetic fixtures | Valid and deliberately invalid JSON fixtures |
| 3 | Implement minimal UBL generation and run pinned KoSIT bundle | Original XML and raw validation report |
| 4 | Normalize official findings; distinguish errors, unsupported cases and engine failures | Machine-readable report with rule IDs and source paths |
| 5 | Establish repository layout, local containers, CI and migrations | One documented command boots/test-runs the slice |
| 6 | Persist source/revision/artifact records and hashes | Reloading preserves exact bytes and provenance |
| 7 | Add durable processing job and API idempotency | Duplicate request and worker-crash tests pass |
| 8 | Add minimal invoice list/detail and structured preview | Browser shows real engine results |
| 9 | Add revision correction and evidence download | Invalid → corrected → valid walkthrough |
| 10 | Demonstrate, record gaps, estimate next sprint from results | Runnable local demonstrator checkpoint; week-4 release still includes completion/hardening |

In parallel, founder selects potential partners, secures permission for sample data, identifies three target recipients, and arranges a domain reviewer. Missing customer material does not block these synthetic-data tasks.

## 11. Test strategy and pilot measurement

Maintain four fixture groups: public official examples with license/source provenance; synthetic edge cases; authorized anonymized pilot cases; malicious/failure cases. Target at least 50 varied fixtures for the demonstrator and 100 for v1, but coverage and independently expected outcomes matter more than count.

Required coverage includes multiple VAT rates, decimal quantities, rounding boundaries, allowances/charges, missing references, leading-zero IDs, dates, credit notes, attachments, CSV locale/grouping errors, duplicate imports, forbidden tenant access, XXE, oversized inputs, worker crashes, stale approvals, provider timeouts, webhook replays, expired profiles and future rule regressions.

- Unit/property tests protect arithmetic and transitions; use independently worked expected values.
- Integration tests run real PostgreSQL and invoice engines, not only mocks.
- Golden tests compare semantic invoice values and findings; byte hashes verify preserved originals, not assumed deterministic PDF metadata.
- Browser tests cover import, correction, approval, export and role restrictions.
- Transport tests use provider sandbox/fakes for failure simulation, then customer-approved actual routes for acceptance testing.
- ZUGFeRD tests validate both the PDF container and embedded XML and compare extracted invoice values to the approved revision.
- Security/recovery tests verify isolation and restored dispatch reconciliation; external review focuses on these high-risk paths.

Pilot onboarding: one entity, one export, 20–50 representative invoices, up to five recipients, named finance/technical owners, supported transaction cases, agreed archive destination and production route. Run shadow processing before sending. The customer approves the mapping, authoritative values and first live batch. A successful standards check is not a substitute for actual buyer feedback.

Track the existing discovery metrics plus operational measures:

| Metric | Definition / proposed pilot target |
|---|---|
| Recipient-confirmed first-pass acceptance | Accepted without correction / first submissions with known recipient outcomes; display unknown count and response coverage separately |
| Preventable rejection | Recipient rejection attributable to a supported, known requirement missed by FakturaPass; investigate every case |
| Time to ready | Median/p95 from complete export receipt to approved output; compare to customer baseline |
| Manual effort | Minutes per 100 processed invoices, separated into onboarding and recurring operations |
| Reuse | Mapping/rule reused in at least 3 organizations, with private data removed |
| Safety | Zero unauthorized disclosure, silent authoritative-data change, or platform-caused duplicate dispatch |
| Commercial | Three paid pilot customers targeted; evidence of recurring willingness to pay and a measured service cost |

Provisional progression target: reduce recurring manual handling by at least 50% against an observed baseline, obtain business-response evidence for at least 80% of the agreed pilot evaluation set, and reproduce all known supported failure detections. These are targets to validate with the founder and customer, not promised outcomes. If acceptance evidence is sparse, report the limitation rather than inventing an acceptance rate.

## 12. Production launch checklist

Release is complete only when all applicable items are evidenced:

- [ ] Supported transaction/input/output/channel matrix published and enforced by API/UI.
- [ ] UBL and ZUGFeRD outputs pass pinned selected rules on the agreed corpus.
- [ ] Unsupported inputs, failed engines and unknown recipient coverage fail safely.
- [ ] Source-to-error provenance, revision approvals and issued-artifact immutability verified.
- [ ] Tenant, role, API-key, object-download and job authorization tests pass.
- [ ] Submission uncertainty, retries, bounces and recipient outcomes are correctly represented.
- [ ] Evidence export and customer archival handoff tested; retention responsibilities agreed.
- [ ] Billing measures agreed units once; failed payment does not erase evidence or prevent necessary export.
- [ ] Backup restore, dispatch reconciliation and rule rollback rehearsed successfully.
- [ ] Load targets measured on declared infrastructure and limits enforced.
- [ ] External security review completed; no unresolved critical/high issue affecting launch scope.
- [ ] Customer UAT signed for each production path and support owners named.
- [ ] DPA/AVV, privacy/subprocessor terms, retention, incident handling and service scope reviewed.
- [ ] Working-name/domain/trademark review completed before public branding investment.
- [ ] No unverified customer logos, universal compliance claims or promised acceptance rate in marketing.
- [ ] Founder records go/no-go based on technical evidence and commercial pilot results.

## 13. Resourcing, cost and commercial boundaries

The schedule assumes one engineer can devote most of the week to this project, with founder-led discovery and a specialist available at the engine/format and launch gates. If one person handles all interviews, engineering, legal/provider procurement and support, allow materially more elapsed time. AI assistance does not remove external review or real-world recipient testing.

Planning envelope: 18 active weeks × 5 days = 90 engineer-days, plus 10–20 contingency days. At an illustrative external rate of €600–€900/day, that is **€60,000–€99,000 including contingency**, excluding VAT and specialist/provider costs. This is arithmetic for budgeting, not a market-rate quote; founder-built cash cost can be lower while time cost remains.

Set provisional spending caps of €300–€800/month for pilot infrastructure/services and €800–€2,000/month for initial commercial operation. These are budget assumptions, not verified provider prices. Before purchase, obtain region-specific estimates for compute, database backups, storage/retention, email, monitoring, identity and validation/transport usage. Add separate quotes for security and German legal/domain review. Provider cost uncertainty is a week-1/launch procurement task.

Use manual audit/pilot billing initially. Before FP-017, decide whether a billable unit is a unique approved production invoice, generated artifact, or delivery; recommended default is one unique production invoice, with revalidation/retry free and transport fees explicit. Track credits and corrections as auditable adjustments. Keep plan prices/limits configurable. Validate €149/€399 subscription hypotheses against measured customer value and support cost; do not present them as proven pricing.

## 14. Decision register and risk ownership

| Decision / risk | Default now | Owner and deadline | If unresolved |
|---|---|---|---|
| First ERP/export | CSV/JSON canonical intake; no vendor-specific connector promised | Founder + pilot technical owner, week 4 | Continue synthetic core; defer bespoke mapping |
| First recipients | Three synthetic examples, then actual sourced profiles | Founder/domain reviewer, before pilot setup | Recipient checks stay unknown and manual review required |
| Generation/validation stack | UBL serializer + KoSIT; Mustang spike for hybrid output | Engineer, week 1 and before FP-015 | Compare a licensed provider behind the same contract; update estimate |
| Supported tax cases | Domestic ordinary EUR invoices; explicit matrix | Domain reviewer, week 1/pilot gate | Block unsupported cases rather than infer tax treatment |
| Hosting/identity/email | Germany/EU deployment, provider adapters | Engineer + founder, before live pilot | Local/synthetic operation continues |
| Archive responsibility | Customer archive with verified evidence handoff | Founder/customer, before live processing | No live unattended workflow without retention agreement |
| Delivery/Peppol | Download/API first, email when permitted | Customer + founder, week 4 | Move channel milestone if actual buyer needs Peppol |
| Rule staleness | Sourced versions, monthly review queue and pre-release checks | Domain owner, recurring once operational | Mark uncertain; require review, block unsupported transport |
| Scope becomes consulting | One entity/export, reusable rule set per pilot | Founder, every onboarding | Reprice/narrow; do not absorb unlimited bespoke work |
| Low demand | Evidence thresholds from validation plan | Founder, week 4 and week 10 | Narrow/reposition commercial rollout while preserving reusable core |
| Security or duplicate-send flaw | P0 incident and release blocker | Engineer, immediately | Disable affected route, reconcile, repair and retest |
| Public claims and naming | Working brand; scoped technical claims only | Founder, before public launch | Keep private pilot positioning |

## 15. Immediate implementation handoff

Begin with **FP-001, FP-002 and FP-003** in the existing E-invoice workspace. The first meaningful review should show an actual invoice generated from canonical JSON, a real KoSIT report, one detected recipient-reference error, a corrected revision and a downloadable evidence bundle. It should not be a dashboard backed only by mock success states.

During implementation, keep this plan as the baseline, record architectural decisions in `docs/adr/`, and maintain a dated delivery checklist. Re-estimate after the week-1 engine spike and week-4 artifact review. The next implementation instruction can be:

> Implement FakturaPass phase 0 and the first vertical slice from this plan. Start with the canonical contract, supported-case matrix, pinned KoSIT validation and XRechnung UBL generation. Use synthetic fixtures, build a reproducible local environment, and demonstrate valid and invalid invoices with source-linked findings and evidence. Keep live delivery disabled until its release gate is met.

### Evidence boundary

This planning task reviewed source drafts, checked selected official technical/regulatory references and produced this development plan. It did not validate market demand, execute the proposed engine spike, test generated invoices, approve providers, launch infrastructure or send customer messages. References were checked on 11 September 2026; versions and legal/provider requirements must be rechecked at the implementation/release gates.
