# Release A implementation decisions

Status: accepted implementation decisions. Date: 2026-09-12. Owner: implementation.

The authoritative architecture remains Next.js, TypeScript, PostgreSQL durable jobs and an isolated Java KoSIT daemon. A local browser identity is enabled only by explicit LOCAL configuration and loopback hostname; writes require same-origin requests. API bearer identities map server-side to a tenant and role. Production identity is disabled and remains TBD.

Validation and generation consistently return HTTP 202 with a durable validation run ID. Polling GET /validation-runs/{id} resolves the result. Leases expire after 120 seconds; engine calls time out after 60 seconds. Engine failures retain recoverable technical status and retry after five seconds. Generation and its persisted validation/evidence commit in one transaction, so a crash repeats deterministic work without duplicate artifacts.

Sources and XML bytes use a PostgreSQL bytea adapter with immutable database triggers and private authenticated retrieval. This provides atomic byte/hash/metadata storage without requiring a separate local object service. Production object storage remains behind its later gate.

Canonical JSON uses recursive Unicode-key ordering via JavaScript Object.keys().sort(), UTF-8 JSON.stringify without whitespace, and unchanged decimal/date strings. Rounding uses decimal.js precision 160 and ROUND_HALF_UP to two decimals for calculated monetary terms. No declared totals are overwritten.

ProfileID is a fixed syntax mapping constant for the supported standard billing process, not an inferred recipient route. Credit notes and unsupported processes remain blocked.

The foreign-currency fixture conflicts with the closed EUR-only canonical schema. Higher-precedence schema rejects it with SCHEMA_INVALID before persistence; the fixture records this explicitly. Reduced-rate FP-A-002 remains PENDING_SUPPORT under TBD-010.

The original FP-A-001 lacks seller.contact.phone, required by XRechnung BR-DE-6. The schema already represents this field, so no canonical field change is needed. Preserve the original fixture as a negative case; the runnable positive synthetic fixture explicitly supplies +49 30 5550100 as test input. The generator never inserts a telephone number.

Reversal trigger: production identity/object store choices, promoted support cases, or a canonical schema change require a new ADR and representative fixtures.

Evidence retrieval accepts optional revisionId to return an authorized historical immutable manifest. The default remains the current revision. This additive query is documented in OpenAPI; history views never download a different revision's evidence.

The real KoSIT VARL report identifies the telephone requirement as BR-DE-6 (BT-42), with advisory BR-DE-27. Findings are parsed from rep:message, preserving information/warning/error severity and xpathLocation. The valid fixtures also carry informational BR-DE-TMP-32 about service/delivery dates; these are retained, never silently omitted or filled from issueDate.

Local CSRF validation compares Origin with the incoming loopback Host header after strictly validating that authority. Next.js may normalize Request.url to localhost even when the browser used 127.0.0.1; comparing to that internal URL would reject legitimate imports. Forwarded host headers are not used to establish trust.

The same closed JSON Schema validator now runs before the UI import preview and again at the API boundary. Malformed JSON structures cannot crash the preview, and field errors appear before a source is committed.

Decimal strings are limited to 64 characters as an input resource bound. Arithmetic uses 160 digits of precision, covering the maximum input multiplication and sums without binary floating point. This is an operational bound, not inferred rounding of source values.
