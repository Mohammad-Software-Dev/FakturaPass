import { readFileSync, writeFileSync } from "node:fs";
import YAML from "yaml";
const invoice = JSON.parse(
  readFileSync("packages/contracts/schemas/invoice-v1.schema.json", "utf8"),
);
delete invoice.$id;
delete invoice.$schema;
const str = { type: "string" };
const nullable = { type: ["string", "null"] };
const object = (
  properties: Record<string, unknown>,
  required = Object.keys(properties),
) => ({ type: "object", properties, required, additionalProperties: false });
const ref = (s: string) => ({ $ref: `#/components/schemas/${s}` });
const content = (schema: unknown) => ({ "application/json": { schema } });
const paths: Record<string, any> = {};
const operations: [
  string,
  string,
  string,
  string,
  string | undefined,
  number,
][] = [
  [
    "/invoices",
    "post",
    "createInvoice",
    "Ingest canonical invoice; same key/body replays original response, changed body conflicts.",
    "Invoice",
    201,
  ],
  [
    "/invoices",
    "get",
    "listInvoices",
    "List current revisions, tenant-scoped.",
    undefined,
    200,
  ],
  [
    "/invoices/{invoiceId}",
    "get",
    "getInvoice",
    "Get current revision and immutable history.",
    undefined,
    200,
  ],
  [
    "/invoices/{invoiceId}/revisions/{revisionId}",
    "get",
    "getInvoiceRevision",
    "Read an immutable canonical revision.",
    undefined,
    200,
  ],
  [
    "/invoices/{invoiceId}/revisions",
    "post",
    "createInvoiceRevision",
    "Create full corrected revision; stale priorRevisionId returns REVISION_CONFLICT.",
    "Correction",
    201,
  ],
  [
    "/invoices/{invoiceId}/revisions/{revisionId}/validate",
    "post",
    "validateInvoiceRevision",
    "Enqueue/reuse durable validation by revision, profile and rules. Always returns 202.",
    "ValidationRequest",
    202,
  ],
  [
    "/validation-runs/{validationRunId}",
    "get",
    "getValidationRun",
    "Poll immutable result after asynchronous execution.",
    undefined,
    200,
  ],
  [
    "/invoices/{invoiceId}/revisions/{revisionId}/approve",
    "post",
    "approveInvoiceRevision",
    "Approve only matching successful current revision and profile.",
    "ApprovalRequest",
    201,
  ],
  [
    "/invoices/{invoiceId}/revisions/{revisionId}/generate",
    "post",
    "generateInvoiceArtifact",
    "Enqueue/reuse deterministic approved generation. Always returns 202; poll validation run then read revision artifacts.",
    "Empty",
    202,
  ],
  [
    "/artifacts/{artifactId}",
    "get",
    "getArtifact",
    "Read authorized artifact metadata.",
    undefined,
    200,
  ],
  [
    "/artifacts/{artifactId}/download",
    "get",
    "downloadArtifact",
    "Download the exact persisted and validated XML bytes.",
    undefined,
    200,
  ],
  [
    "/invoices/{invoiceId}/evidence",
    "get",
    "getInvoiceEvidence",
    "Download immutable manifest with complete findings and rule versions.",
    undefined,
    200,
  ],
  [
    "/recipient-profiles/{recipientKey}",
    "get",
    "getRecipientProfile",
    "Read the current recipient profile, its provenance and immutable version.",
    undefined,
    200,
  ],
  [
    "/health/live",
    "get",
    "healthLive",
    "Liveness; no tenant data.",
    undefined,
    200,
  ],
  [
    "/health/ready",
    "get",
    "healthReady",
    "Checks PostgreSQL and official engine.",
    undefined,
    200,
  ],
];
operations.push(
  [
    "/review-queue",
    "get",
    "listReviewQueue",
    "Read derived invoice exceptions and ownership within the tenant.",
    undefined,
    200,
  ],
  [
    "/review-queue/{invoiceId}/assignment",
    "post",
    "assignReview",
    "Claim for the authenticated actor or release ownership with optimistic concurrency.",
    "ReviewAssignmentRequest",
    200,
  ],
  [
    "/recipient-profiles",
    "get",
    "listRecipientProfiles",
    "List tenant profiles and unverified reference presets.",
    undefined,
    200,
  ],
  [
    "/recipient-profiles",
    "post",
    "publishRecipientProfile",
    "Publish an immutable tenant-owned profile version as an administrator.",
    "PublishRecipientProfile",
    201,
  ],
  [
    "/recipient-profiles/{recipientKey}/versions",
    "get",
    "listRecipientProfileVersions",
    "Read immutable version history within the tenant.",
    undefined,
    200,
  ],
  [
    "/mapping-recipes",
    "get",
    "listMappingRecipes",
    "Read configured immutable tenant mapping recipes.",
    undefined,
    200,
  ],
  [
    "/csv/preview",
    "post",
    "previewCsv",
    "Group CSV rows and return source-linked findings without saving.",
    "CsvInput",
    200,
  ],
  [
    "/csv/import",
    "post",
    "importCsv",
    "Atomically commit a previewed CSV batch, retaining source and mapping provenance.",
    "CsvCommit",
    200,
  ],
);
const responseNames: Record<string, string> = {
  listReviewQueue: "ReviewQueue",
  assignReview: "ReviewAssignment",
  createInvoice: "CreatedInvoice",
  listInvoices: "InvoiceList",
  getInvoice: "InvoiceDetail",
  getInvoiceRevision: "Revision",
  createInvoiceRevision: "CreatedInvoice",
  validateInvoiceRevision: "PendingRun",
  generateInvoiceArtifact: "PendingRun",
  getValidationRun: "ValidationRun",
  approveInvoiceRevision: "Approval",
  getArtifact: "Artifact",
  getInvoiceEvidence: "Evidence",
  getRecipientProfile: "RecipientProfile",
  listRecipientProfiles: "RecipientProfileList",
  publishRecipientProfile: "RecipientProfile",
  listRecipientProfileVersions: "RecipientProfileList",
  healthLive: "Health",
  healthReady: "Health",
  listMappingRecipes: "RecipeList",
  previewCsv: "CsvPreview",
  importCsv: "CsvImported",
};
for (const [path, method, id, description, request, status] of operations) {
  const op: any = {
    operationId: id,
    description,
    security: path.startsWith("/health")
      ? []
      : [{ localDev: [] }, { oidcBearer: [] }, { apiKey: [] }],
    parameters: [
      ...Array.from(path.matchAll(/\{([^}]+)\}/g), (m) => ({
        name: m[1],
        in: "path",
        required: true,
        schema: str,
      })),
      {
        name: "X-Request-Id",
        in: "header",
        schema: { type: "string", maxLength: 100 },
      },
    ],
    responses: {
      [status]: {
        description: "Successful operation",
        headers: { "X-Request-Id": { schema: str } },
        content: content(ref(responseNames[id] ?? "Empty")),
      },
    },
  };
  if (request)
    op.requestBody = { required: true, content: content(ref(request)) };
  for (const code of [400, 401, 403, 404, 409, 413, 422, 500, 503])
    op.responses[code] = {
      description: "Safe stable error envelope",
      content: content(ref("Error")),
    };
  if (id === "createInvoice" || id === "importCsv")
    op.parameters.push({
      name: "Idempotency-Key",
      in: "header",
      required: true,
      schema: { type: "string", minLength: 1, maxLength: 200 },
    });
  if (id === "listInvoices")
    op.parameters.push(
      ...[
        { name: "status", schema: str },
        { name: "cursor", schema: str },
        {
          name: "limit",
          schema: { type: "integer", minimum: 1, maximum: 100, default: 50 },
        },
      ].map((v) => ({ ...v, in: "query" })),
    );
  if (id === "getInvoiceEvidence")
    op.parameters.push({
      name: "revisionId",
      in: "query",
      schema: str,
      description:
        "Optional immutable historical revision; defaults to current.",
    });
  if (id === "downloadArtifact")
    op.responses[200].content = {
      "application/xml": { schema: { type: "string" } },
    };
  if (id === "listReviewQueue")
    op.parameters.push(
      ...["owner", "reason", "cursor", "limit"].map((name) => ({
        name,
        in: "query",
        schema:
          name === "limit"
            ? { type: "integer", minimum: 1, maximum: 100 }
            : str,
      })),
    );
  paths[path] ??= {};
  paths[path][method] = op;
}
const schemas: any = {
  Invoice: invoice,
  Empty: object({}),
  Correction: object({ priorRevisionId: str, canonical: ref("Invoice") }),
  ValidationRequest: object({ recipientProfileVersionId: nullable }, []),
  ApprovalRequest: object(
    { validationRunId: str, recipientProfileVersionId: nullable },
    ["validationRunId"],
  ),
  Error: object({
    error: object({
      code: str,
      message: str,
      requestId: str,
      details: { type: "object" },
    }),
  }),
  Finding: object({
    code: str,
    severity: { enum: ["ERROR", "WARNING", "INFO"] },
    layer: { enum: ["SCHEMA", "SEMANTIC", "STANDARD", "RECIPIENT", "SYSTEM"] },
    canonicalPath: str,
    sourcePath: nullable,
    ruleId: nullable,
    messageKey: str,
    parameters: { type: "object" },
    evidenceSource: nullable,
  }),
  PendingRun: object({ validationRunId: str, status: { const: "PENDING" } }),
  CreatedInvoice: object({
    invoiceId: str,
    revisionId: str,
    revisionNumber: { type: "integer" },
    status: str,
    canonicalSha256: str,
    validationSummary: { type: ["object", "null"] },
  }),
  InvoiceSummary: object({
    invoiceId: str,
    currentRevisionId: str,
    revisionNumber: { type: "integer" },
    sourceSystem: str,
    sourceRecordId: str,
    documentNumber: str,
    buyerName: str,
    issueDate: str,
    currency: str,
    payableAmount: str,
    status: str,
    validationResult: nullable,
    standardResult: nullable,
    recipientCoverage: str,
    updatedAt: str,
  }),
  InvoiceList: object({
    items: { type: "array", items: ref("InvoiceSummary") },
    nextCursor: nullable,
  }),
  ValidationRun: object({
    validationRunId: str,
    status: { enum: ["PENDING", "PASS", "FAIL", "ERROR"] },
    kind: str,
    ruleManifest: { type: "object" },
    engineVersion: str,
    recipientProfileVersionId: nullable,
    recipientSnapshot: { type: ["object", "null"] },
    summary: { type: "object" },
    findings: { type: "array", items: ref("Finding") },
    createdAt: str,
    completedAt: nullable,
    xmlSha256: nullable,
  }),
  Approval: object({
    approvalId: str,
    revisionId: str,
    canonicalSha256: str,
    approvedAt: str,
    approver: str,
  }),
  Revision: object({
    revisionId: str,
    invoiceId: str,
    revisionNumber: { type: "integer" },
    canonical: ref("Invoice"),
    canonicalSha256: str,
    sourceArtifact: { type: "object" },
    status: str,
    validationRuns: { type: "array", items: ref("ValidationRun") },
    approval: { type: ["object", "null"] },
    artifacts: { type: "array", items: { type: "object" } },
  }),
  Artifact: object({
    artifactId: str,
    invoiceId: str,
    revisionId: str,
    syntax: { const: "XRECHNUNG_UBL" },
    profile: str,
    generatorVersion: str,
    sha256: str,
    createdAt: str,
    validationStatus: str,
  }),
  Evidence: object({
    manifestVersion: { const: "fakturapass.evidence.v1" },
    tenantId: str,
    invoiceId: str,
    revisionId: str,
    source: { type: "object" },
    canonical: { type: "object" },
    generation: { type: ["object", "null"] },
    validation: { type: "object" },
    recipientProfile: { type: "object" },
    createdAt: str,
  }),
  Health: object({ status: { enum: ["ok", "ready", "not_ready"] } }),
};
schemas.RecipientProfileInput = object({
  recipientKey: str,
  displayName: str,
  status: { enum: ["UNVERIFIED", "TENANT_VERIFIED", "RETIRED"] },
  identifiers: { type: "array", items: object({ schemeId: str, value: str }) },
  accepted: object({
    syntaxes: { type: "array", items: str },
    profiles: { type: "array", items: str },
    channels: { type: "array", items: str },
  }),
  requirements: {
    type: "array",
    items: object({
      id: str,
      fieldPath: str,
      predicate: { const: "PRESENT" },
      severity: { enum: ["ERROR", "WARNING"] },
      messageKey: { const: "RECIPIENT_REQUIREMENT_MISSING" },
    }),
  },
  evidence: {
    type: "array",
    items: object({
      sourceType: str,
      title: str,
      urlOrReference: str,
      retrievedAt: str,
      effectiveFrom: nullable,
      reviewedAt: str,
    }),
  },
  expiresAt: nullable,
});
schemas.RecipientProfile = object(
  {
    ...schemas.RecipientProfileInput.properties,
    status: { enum: ["UNVERIFIED", "TENANT_VERIFIED", "RETIRED", "SYNTHETIC"] },
    required: { type: "array", items: str },
    versionId: str,
    version: str,
    sha256: str,
    createdBy: nullable,
    createdAt: nullable,
    current: { type: "boolean" },
    coverage: str,
  },
  [
    ...schemas.RecipientProfileInput.required,
    "versionId",
    "version",
    "sha256",
    "createdBy",
    "createdAt",
    "current",
  ],
);
schemas.RecipientProfileList = object({
  items: { type: "array", items: ref("RecipientProfile") },
});
schemas.PublishRecipientProfile = object({
  profile: ref("RecipientProfileInput"),
  priorVersionId: nullable,
});
schemas.ReviewAssignmentRequest = object({
  action: { enum: ["CLAIM", "RELEASE"] },
  expectedRevisionId: str,
  expectedVersion: { type: "integer", minimum: 0 },
});
schemas.ReviewAssignment = object({
  owner: nullable,
  version: { type: "integer" },
  updatedAt: nullable,
  isMine: { type: "boolean" },
});
schemas.ReviewQueue = object({
  items: {
    type: "array",
    items: object({
      invoiceId: str,
      revisionId: str,
      revisionNumber: { type: "integer" },
      documentNumber: str,
      buyerName: str,
      sourceRecordId: str,
      payableAmount: str,
      currency: str,
      status: str,
      recipientCoverage: str,
      reasons: { type: "array", items: str },
      priority: { type: "integer" },
      createdAt: str,
      assignment: ref("ReviewAssignment"),
    }),
  },
  total: { type: "integer" },
  counts: object({
    all: { type: "integer" },
    mine: { type: "integer" },
    unassigned: { type: "integer" },
  }),
  nextCursor: nullable,
  canManage: { type: "boolean" },
});
schemas.CsvInput = object({
  csv: { type: "string", maxLength: 524288 },
  recipeId: str,
  recipeVersion: str,
});
schemas.CsvCommit = object({
  ...schemas.CsvInput.properties,
  sourceSha256: str,
  recipeSha256: str,
});
schemas.RecipeList = object({
  items: {
    type: "array",
    items: object({
      id: str,
      version: str,
      name: str,
      sha256: str,
      delimiter: { enum: [",", ";"] },
    }),
  },
});
schemas.CsvPreview = object({
  sourceSha256: str,
  recipeId: str,
  recipeVersion: str,
  recipeSha256: str,
  items: {
    type: "array",
    items: object({
      sourceId: str,
      rows: { type: "array", items: { type: "integer" } },
      canonical: { type: "object" },
      provenance: { type: "object" },
      findings: { type: "array", items: ref("Finding") },
      valid: { type: "boolean" },
    }),
  },
});
schemas.CsvImported = object({
  items: {
    type: "array",
    items: object({
      sourceId: str,
      invoiceId: str,
      status: { enum: ["IMPORTED", "EXISTS"] },
    }),
  },
});
schemas.InvoiceDetail = {
  ...schemas.InvoiceSummary,
  properties: {
    ...schemas.InvoiceSummary.properties,
    revisions: { type: "array", items: { type: "object" } },
    currentRevision: ref("Revision"),
  },
  required: [
    ...schemas.InvoiceSummary.required,
    "revisions",
    "currentRevision",
  ],
};
for (const operations of Object.values(paths)) {
  for (const operation of Object.values(operations) as any[]) {
    operation.parameters ??= [];
    operation.parameters.push({
      name: "Accept-Language",
      in: "header",
      required: false,
      schema: { type: "string" },
      description:
        "Optional language preference for error messages and recipient display labels. Supports de and en (including regional tags and quality weights), default de. Codes, invoice data, XML and saved evidence are language-independent.",
    });
  }
}
const spec = {
  openapi: "3.1.0",
  info: {
    title: "FakturaPass Release A",
    version: "1.0.0",
    description:
      "Local synthetic demonstrator. Production OIDC/API keys are gated and not enabled.",
  },
  servers: [{ url: "/api/v1" }],
  paths,
  components: {
    securitySchemes: {
      localDev: {
        type: "http",
        scheme: "bearer",
        description:
          "Explicit LOCAL-only server configured bearer identity; loopback browser adapter requires LOCAL_BROWSER_IDENTITY and same-origin writes.",
      },
      oidcBearer: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Production contract only; unavailable in Release A.",
      },
      apiKey: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
        description: "Production contract only; unavailable in Release A.",
      },
    },
    schemas,
  },
};
writeFileSync(
  "packages/contracts/openapi.yaml",
  YAML.stringify(spec, { aliasDuplicateObjects: false }),
);
