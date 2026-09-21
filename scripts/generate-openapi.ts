import {
  credentialScopes,
  requiredCredentialScope,
} from "../packages/identity/credential-scopes";
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
operations.push(
  [
    "/memberships",
    "get",
    "listMemberships",
    "Administrator-only membership listing for the authenticated tenant.",
    undefined,
    200,
  ],
  [
    "/memberships/{membershipId}",
    "post",
    "updateMembership",
    "Update role/status with version checks, audit and last-active-admin protection.",
    "MembershipUpdate",
    200,
  ],
);
const responseNames: Record<string, string> = {
  listMemberships: "MembershipList",
  updateMembership: "Membership",
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
      : [{ localDev: [] }, { browserSession: [] }],
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
  Membership: object({
    id: str,
    subject: str,
    role: { enum: ["ADMIN", "OPERATOR", "APPROVER", "READ_ONLY"] },
    status: { enum: ["ACTIVE", "SUSPENDED"] },
    version: { type: "integer", minimum: 1 },
    updatedAt: { type: "string", format: "date-time" },
  }),
  MembershipList: object({
    actor: str,
    items: { type: "array", items: ref("Membership") },
  }),
  MembershipUpdate: object({
    role: { enum: ["ADMIN", "OPERATOR", "APPROVER", "READ_ONLY"] },
    status: { enum: ["ACTIVE", "SUSPENDED"] },
    expectedVersion: { type: "integer", minimum: 1 },
  }),
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
for (const [action, method] of [
  ["login", "post"],
  ["callback", "get"],
  ["logout", "post"],
]) {
  paths[`/auth/${action}`] = {
    [method]: {
      operationId: `oidc${action[0].toUpperCase()}${action.slice(1)}`,
      description:
        "Configured OIDC browser flow. Login/logout require same-origin POST. Callback verifies state, nonce and PKCE. Disabled outside OIDC mode.",
      security: action === "logout" ? [{ browserSession: [] }] : [],
      parameters:
        action === "callback"
          ? ["code", "state", "error"].map((name) => ({
              name,
              in: "query",
              required: false,
              schema: str,
            }))
          : [],
      ...(method === "post"
        ? {
            requestBody: {
              required: false,
              content: {
                "application/x-www-form-urlencoded": {
                  schema: { type: "object" },
                },
              },
            },
          }
        : {}),
      responses: {
        "303": {
          description: "Continue to provider, workspace or sign-in result.",
          headers: { Location: { schema: { type: "string", format: "uri" } } },
        },
        "403": { description: "Origin rejected" },
        "404": { description: "OIDC disabled" },
      },
    },
  };
}
paths["/auth/workspaces"] = {
  get: {
    operationId: "oidcWorkspaces",
    description:
      "List only active memberships for the verified session identity. Does not change the workspace of other tabs.",
    security: [{ browserSession: [] }],
    parameters: [],
    responses: {
      "200": {
        description: "Available workspaces",
        content: content(
          object({
            items: {
              type: "array",
              items: object({
                id: str,
                name: str,
                role: { enum: ["ADMIN", "OPERATOR", "APPROVER", "READ_ONLY"] },
              }),
            },
          }),
        ),
      },
      "401": { description: "Session missing or expired" },
      "404": { description: "OIDC disabled" },
    },
  },
};
const inviteRole = { enum: ["ADMIN", "OPERATOR", "APPROVER", "READ_ONLY"] };
const inviteInput = object({ email: str, role: inviteRole });
const inviteItem = object({
  id: str,
  email: str,
  role: inviteRole,
  expiresAt: str,
  status: {
    enum: ["PENDING", "ACCEPTED", "REVOKED", "EXPIRED", "UNAVAILABLE"],
  },
});
const inviteOperation = (
  operationId: string,
  description: string,
  schema: unknown,
  status = 200,
) => ({
  operationId,
  description,
  security: [{ browserSession: [] }],
  parameters: [],
  responses: {
    [status]: { description: "Success", content: content(schema) },
    "400": { description: "Invalid request" },
    "401": { description: "Sign-in required" },
    "403": { description: "Access denied" },
    "404": { description: "Not found or OIDC disabled" },
    "409": { description: "Conflict" },
  },
});
paths["/invitations"] = {
  get: inviteOperation(
    "listInvitations",
    "Administrator-only invitation history for this workspace. No secrets are returned.",
    object({ items: { type: "array", items: inviteItem } }),
  ),
  post: {
    ...inviteOperation(
      "createInvitation",
      "Create a 72-hour invitation. The one-time response contains a private fragment link to share manually. Replaces pending invitations to this exact address.",
      object({ id: str, url: str, expiresAt: str }),
      201,
    ),
    requestBody: { required: true, content: content(inviteInput) },
  },
};
paths["/invitations/{invitationId}"] = {
  post: {
    ...inviteOperation(
      "revokeInvitation",
      "Administrator revocation; cannot revoke accepted invitations. Suspend the membership instead.",
      object({ id: str, status: { const: "REVOKED" } }),
    ),
    parameters: [
      { name: "invitationId", in: "path", required: true, schema: str },
    ],
    requestBody: { required: false, content: content({ type: "object" }) },
  },
};
paths["/auth/invitation"] = {
  post: {
    ...inviteOperation(
      "previewInvitation",
      "Preview a valid invitation by secret token; requires same-origin POST. No membership is granted.",
      object({
        id: str,
        email: str,
        role: inviteRole,
        organization: str,
        expiresAt: str,
      }),
    ),
    security: [],
    requestBody: { required: true, content: content(object({ token: str })) },
  },
};
paths["/auth/join"] = {
  post: {
    operationId: "joinInvitation",
    description:
      "Same-origin form POST starts OIDC with an invitation bound to its login transaction. Callback requires a matching provider-verified email before granting membership.",
    security: [],
    parameters: [],
    requestBody: {
      required: true,
      content: {
        "application/x-www-form-urlencoded": { schema: object({ token: str }) },
      },
    },
    responses: {
      "303": {
        description: "Continue to provider or invitation error",
        headers: { Location: { schema: str } },
      },
      "400": { description: "Invalid request" },
      "403": { description: "Origin rejected" },
      "404": { description: "OIDC disabled" },
      "413": { description: "Body too large" },
    },
  },
};
const credentialSchema = object({
  id: str,
  name: str,
  owner: str,
  environment: str,
  scopes: {
    type: "array",
    items: { type: "string", enum: Object.keys(credentialScopes) },
  },
  version: { type: "integer" },
  createdAt: { type: "string", format: "date-time" },
  expiresAt: { type: "string", format: "date-time" },
  lastUsedAt: { type: ["string", "null"], format: "date-time" },
  status: {
    type: "string",
    enum: ["ACTIVE", "REVOKED", "EXPIRED", "UNAVAILABLE"],
  },
});
const credentialSecretSchema = {
  ...credentialSchema,
  properties: { ...credentialSchema.properties, secret: str },
  required: [...credentialSchema.required, "secret"],
};
for (const [path, method, id, request, response, status] of [
  [
    "/api-credentials",
    "get",
    "listApiCredentials",
    null,
    object({ items: { type: "array", items: credentialSchema } }),
    200,
  ],
  [
    "/api-credentials",
    "post",
    "createApiCredential",
    object({
      name: { type: "string", minLength: 1, maxLength: 80 },
      scopes: {
        type: "array",
        minItems: 1,
        uniqueItems: true,
        items: { type: "string", enum: Object.keys(credentialScopes) },
      },
      expiresInDays: { type: "integer", minimum: 1, maximum: 90 },
    }),
    credentialSecretSchema,
    201,
  ],
  [
    "/api-credentials/{credentialId}/rotate",
    "post",
    "rotateApiCredential",
    object({ expectedVersion: { type: "integer", minimum: 1 } }),
    credentialSecretSchema,
    200,
  ],
  [
    "/api-credentials/{credentialId}/revoke",
    "post",
    "revokeApiCredential",
    object({ expectedVersion: { type: "integer", minimum: 1 } }),
    credentialSchema,
    200,
  ],
] as const) {
  paths[path] ??= {};
  paths[path][method] = {
    operationId: id,
    summary:
      "OIDC administrators only. Rotation is owner-only and preserves expiry and scopes. Secrets are returned once.",
    security: [{ browserSession: [] }],
    parameters: path.includes("{credentialId}")
      ? [{ name: "credentialId", in: "path", required: true, schema: str }]
      : [],
    ...(request
      ? { requestBody: { required: true, content: content(request) } }
      : {}),
    responses: {
      [status]: { description: "Success", content: content(response) },
      "400": { description: "Invalid request" },
      "401": { description: "Sign-in required" },
      "403": { description: "Access denied" },
      "404": { description: "Not found" },
      "409": { description: "Version conflict" },
    },
  };
}
const supportGrantSchema = object({
  id: str,
  agentName: str,
  workspaceName: str,
  invoiceNumber: str,
  revisionNumber: { type: "integer" },
  scope: { type: "string", enum: ["INVOICE_DIAGNOSIS"] },
  reason: str,
  status: {
    type: "string",
    enum: ["ACTIVE", "REVOKED", "EXPIRED", "UNAVAILABLE"],
  },
  expiresAt: { type: "string", format: "date-time" },
  createdAt: { type: "string", format: "date-time" },
  lastViewedAt: { type: ["string", "null"], format: "date-time" },
});
for (const [path, method, id, request, response, status] of [
  [
    "/support-agents",
    "get",
    "listSupportAgents",
    null,
    object({ items: { type: "array", items: object({ id: str, name: str }) } }),
    200,
  ],
  [
    "/support-grants",
    "get",
    "listSupportGrants",
    null,
    object({ items: { type: "array", items: supportGrantSchema } }),
    200,
  ],
  [
    "/support-grants",
    "post",
    "createSupportGrant",
    object({
      agentId: str,
      invoiceId: str,
      revisionId: str,
      reason: { type: "string", minLength: 1, maxLength: 500 },
      hours: { type: "integer", minimum: 1, maximum: 24 },
      consent: { type: "boolean", const: true },
    }),
    supportGrantSchema,
    201,
  ],
  [
    "/support-grants/{grantId}/revoke",
    "post",
    "revokeSupportGrant",
    object({}),
    supportGrantSchema,
    200,
  ],
  [
    "/support/cases",
    "get",
    "listSupportCases",
    null,
    object({ items: { type: "array", items: supportGrantSchema } }),
    200,
  ],
  [
    "/support/cases/{grantId}",
    "get",
    "getSupportDiagnosis",
    null,
    object({
      grant: supportGrantSchema,
      revision: object({ canonical: ref("Invoice"), sha256: str, status: str }),
      validationRuns: {
        type: "array",
        items: object({
          id: str,
          status: str,
          kind: str,
          findings: { type: "array", items: ref("Finding") },
          engineVersion: nullable,
          createdAt: { type: "string", format: "date-time" },
        }),
      },
    }),
    200,
  ],
] as const) {
  paths[path] ??= {};
  paths[path][method] = {
    operationId: id,
    summary: path.startsWith("/support/")
      ? "Verified OIDC specialist; explicit active grant only. Read-only selected revision; no customer membership or file download."
      : "OIDC workspace administrator only. Explicit consent, selected revision and finite expiry.",
    security: [{ browserSession: [] }],
    parameters: path.includes("{grantId}")
      ? [{ name: "grantId", in: "path", required: true, schema: str }]
      : [],
    ...(request
      ? {
          requestBody: {
            required: method !== "post" || id !== "revokeSupportGrant",
            content: content(request),
          },
        }
      : {}),
    responses: {
      [status]: { description: "Success", content: content(response) },
      "400": { description: "Invalid request" },
      "401": { description: "Sign-in required" },
      "403": { description: "Access denied" },
      "404": { description: "Not found" },
    },
  };
}
for (const [path, methods] of Object.entries(paths)) {
  if (
    path.startsWith("/auth") ||
    path.startsWith("/health") ||
    path.startsWith("/support/")
  )
    continue;
  for (const [method, operation] of Object.entries(methods) as [
    string,
    any,
  ][]) {
    const scope = requiredCredentialScope(method.toUpperCase(), path.slice(1));
    if (scope) {
      operation.security.push({ apiKey: [] });
      operation["x-api-key-scope"] = scope;
    }
    operation.parameters.push({
      name: "X-Workspace-Id",
      in: "header",
      required: false,
      schema: str,
      description:
        "Required for OIDC browser sessions; optional for API keys, but must match their workspace. Explicit tab workspace; active membership is checked on every request. LOCAL identities remain server-scoped.",
    });
    if (method === "get")
      operation.parameters.push({
        name: "workspace",
        in: "query",
        required: false,
        schema: str,
        description:
          "OIDC navigation/download alternative to X-Workspace-Id. Conflicting or repeated selectors are rejected.",
      });
  }
}
const spec = {
  openapi: "3.1.0",
  info: {
    title: "FakturaPass Release A",
    version: "1.0.0",
    description:
      "Invoice workspace with configurable OIDC browser sessions. Scoped API credentials are supported; production provider acceptance remains gated.",
  },
  servers: [{ url: "/api/v1" }],
  paths,
  components: {
    securitySchemes: {
      browserSession: {
        type: "apiKey",
        in: "cookie",
        name: "__Host-fakturapass-session",
        description:
          "Opaque OIDC session; LOCAL uses fakturapass-session. Membership checked on every request.",
      },
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
        description:
          "Hash-only, expiring workspace credential. Explicit operation scope and active owner membership are required. No team or credential administration. OIDC configuration required.",
      },
    },
    schemas,
  },
};
writeFileSync(
  "packages/contracts/openapi.yaml",
  YAML.stringify(spec, { aliasDuplicateObjects: false }),
);
