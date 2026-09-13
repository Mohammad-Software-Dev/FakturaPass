# FakturaPass

FakturaPass is a German invoice review application built from the supplied specification pack. This repository implements **Release A**, the local technical demonstrator: canonical JSON import, deterministic monetary checks, real KoSIT XRechnung validation, immutable corrections, approval, UBL generation and downloadable evidence.

## Run locally

Requirements: Node 22.15+ (22.x), npm 11.6.1, Java 25, Docker with Compose, and `unzip`. The first setup downloads the exact pinned official validator and configuration; normal validation runs offline.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:3010**. `npm run dev` starts PostgreSQL, applies explicit migrations, verifies the engine dependencies, starts the Java engine and worker, and opens the local-only web listener. No account or production credentials are required. Startup can take a minute while Java loads the rules. The PostgreSQL volume preserves your synthetic demo data across restarts.

Only one local launcher can use port 3010 at a time. Stop the running launcher with Ctrl+C before starting another one. If another application needs that port, use `PORT=3011 npm run dev` and open the address printed after `FakturaPass is ready`.

In **Importieren**, select your structured invoice JSON, review the preview, import, then choose **Prüfen**, **Revision freigeben** and **XRechnung erstellen**. Download XML and evidence from the invoice workspace. **Formatbeispiel ansehen** provides an optional fictional consulting example; replace its values before importing. Negative and unsupported fixtures remain in the repository test corpus rather than the customer interface.

Stop the application with Ctrl+C. Stop local PostgreSQL separately with `docker compose -f infra/compose.yaml stop`. Do not remove the volume unless you intentionally want to discard the demo database.

## Languages

Use the **Sprache / Language** selector in the top bar to switch between German and English. Your choice is remembered across reloads. The switch preserves the current view and unsaved input. See `docs/INTERNATIONALIZATION.md` for translation coverage and how to add another language.

## Appearance and walkthrough

Use the moon/sun button in the top bar to switch between the blue light and midnight-dark themes. Your choice is remembered without discarding work. Read `docs/USER_GUIDE.md` for story-based walkthroughs of importing, validating, correcting, approving, exporting and auditing invoices. Theme implementation details are in `docs/APPEARANCE.md`.

## Verify

```sh
npx playwright install chromium webkit
npm run verify
```

Verification creates a temporary isolated PostgreSQL database, checks formatting, TypeScript, lint, unit tests, OpenAPI, database/API/official-validator integration, the production build, Chromium and WebKit workflows, and high-severity dependency advisories. It starts its own production web listener on port 3011 and removes only its own temporary test database afterwards. It does not reset the demo database.

Individual commands: `npm test`, `npm run test:integration`, `npm run test:api`, `npm run test:e2e`, `npm run build`. Integration/API tests use DATABASE_URL and create synthetic records; prefer the isolated full verifier.

## Architecture

- `apps/web`: Next.js German interface and all 15 REST operations.
- `apps/worker`: durable PostgreSQL jobs with leases, deduplication and retry.
- `packages/contracts`: closed JSON Schema, TypeScript contracts, OpenAPI 3.1.
- `packages/domain`: exact decimal arithmetic, deterministic UBL, support policy, official validator adapter, workflow service.
- `packages/database`: explicit migrations, immutable semantic records, tenant-scoped foreign keys.
- `packages/mappings`: bounded deterministic transformation interfaces for future mappings.
- `services/invoice-engine`: pinned KoSIT 1.6.3 executable and XRechnung 3.0.2 / 2026-01-31 rules manifest.
- `fixtures`: synthetic inputs, expected findings, golden XML, reports and hashes.

Source bytes and generated XML are stored privately in PostgreSQL bytea columns with SHA-256 hashes. Canonical revisions use sorted-key UTF-8 JSON serialization. Downloads verify persisted bytes; the engine adapter checks that the official report hashes the same XML. Corrections create new revisions; old approvals, outputs and evidence remain available.

## Local authentication and API

The local browser identity is explicitly enabled by the development launcher. Tenant, actor and role are server-owned. Browser mutations require an exact loopback Origin/Host match. The app is bound to loopback; do not expose this development identity on a public host.

For local API experiments, copy `.env.example` to `.env` and configure `LOCAL_API_IDENTITIES` with an object mapping a local bearer token to `{ "tenantId": "local-demo", "actor": "local-api", "role": "ADMIN" }`. Restart the launcher. Send `Authorization: Bearer <your-local-token>` and an `Idempotency-Key` for ingestion. Do not use production credentials. Production OIDC and scoped API keys remain disabled.

The OpenAPI contract is `packages/contracts/openapi.yaml`. Validation and generation always return 202 and a `validationRunId`. Poll `GET /api/v1/validation-runs/{id}`; completed status is PASS or FAIL, while ERROR is recoverable and retried. Read the revision to retrieve generated artifact references. Evidence is JSON, including all findings, the raw official report and pinned rule manifest. `?revisionId=` retrieves historical evidence.

## Scope and documented decisions

Release A supports ordinary DE-to-DE EUR invoices with explicit 19% standard VAT, decimal quantities, supported allowances/charges and supplied references/payment data. It does not decide tax treatment, send invoices or imply recipient acceptance. Reduced VAT, credit notes, ZUGFeRD, live transport, billing and production operations remain gated by the supplied Release B/C requirements.

The original positive fixture omits a mandatory seller telephone number. Its original bytes are retained as a negative case; the positive synthetic fixture explicitly provides a demo number. Foreign currency is rejected by the higher-precedence EUR-only schema. See `docs/adr/0009-release-a-implementation.md`, `docs/TBD.md`, `docs/SUPPORT_MATRIX.md`, `docs/compliance-dependencies.md`, and `docs/RELEASE_A_RESULTS.md`.
