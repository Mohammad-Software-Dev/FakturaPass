import { randomUUID } from "node:crypto";
import { pool, transaction, type DB } from "../database";
import {
  sha256,
  stable,
  schemaFindings,
  semanticFindings,
  GENERATOR_VERSION,
  profiles,
} from "./index";
import { generateUbl } from "./ubl";
import {
  officialValidate,
  ruleManifest,
  ruleManifestHash,
  engineVersion,
} from "./engine";
import type { Invoice, Finding } from "../contracts/types";
export type Context = {
  tenantId: string;
  actor: string;
  role: "ADMIN" | "OPERATOR" | "APPROVER" | "READ_ONLY";
  environment: string;
  requestId: string;
};
export class ApiError extends Error {
  constructor(
    public code: string,
    public status = 400,
    public details: Record<string, unknown> = {},
  ) {
    super(code);
  }
}
const uid = () => randomUUID();
export const counts = (fs: Finding[]) => ({
  error: fs.filter((f) => f.severity === "ERROR").length,
  warning: fs.filter((f) => f.severity === "WARNING").length,
  info: fs.filter((f) => f.severity === "INFO").length,
});
export function authorize(ctx: Context, roles: Context["role"][]) {
  if (!roles.includes(ctx.role)) throw new ApiError("ACCESS_DENIED", 403);
}
export async function revision(
  ctx: Context,
  invoiceId: string,
  revisionId: string,
  db: DB = pool,
) {
  const r = (
    await db.query(
      "SELECT * FROM invoice_revisions WHERE tenant_id=$1 AND invoice_id=$2 AND id=$3",
      [ctx.tenantId, invoiceId, revisionId],
    )
  ).rows[0];
  if (!r) throw new ApiError("RESOURCE_NOT_FOUND", 404);
  return r;
}
async function current(
  ctx: Context,
  invoiceId: string,
  db: DB = pool,
  lock = false,
) {
  if (lock)
    await db.query(
      "SELECT id FROM invoices WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
      [ctx.tenantId, invoiceId],
    );
  const r = (
    await db.query(
      "SELECT * FROM invoice_revisions WHERE tenant_id=$1 AND invoice_id=$2 ORDER BY revision_number DESC LIMIT 1",
      [ctx.tenantId, invoiceId],
    )
  ).rows[0];
  if (!r) throw new ApiError("RESOURCE_NOT_FOUND", 404);
  return r;
}
async function audit(db: DB, ctx: Context, action: string, id: string) {
  await db.query(
    "INSERT INTO audit_events(id,tenant_id,actor_subject,action,resource_type,resource_id,request_id,metadata_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      uid(),
      ctx.tenantId,
      ctx.actor,
      action,
      "invoice",
      id,
      ctx.requestId,
      "{}",
    ],
  );
}
function checkSchema(canonical: unknown) {
  const fs = schemaFindings(canonical);
  if (fs.length) throw new ApiError("SCHEMA_INVALID", 400, { findings: fs });
}
async function insertRevision(
  db: DB,
  ctx: Context,
  invoiceId: string,
  n: number,
  canonical: Invoice,
  raw: Buffer,
  mapping: Record<string, unknown> | null = null,
) {
  const sourceId = uid(),
    revisionId = uid(),
    hash = sha256(stable(canonical));
  await db.query(
    "INSERT INTO source_artifacts(id,tenant_id,environment,source_system,source_record_id,object_key,sha256,media_type,received_at,bytes,mapping_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
    [
      sourceId,
      ctx.tenantId,
      ctx.environment,
      canonical.source.system,
      canonical.source.recordId,
      `source/${sourceId}`,
      sha256(raw),
      mapping ? "text/csv" : "application/json",
      canonical.source.receivedAt,
      raw,
      mapping,
    ],
  );
  await db.query(
    "INSERT INTO invoice_revisions(id,tenant_id,invoice_id,revision_number,schema_version,canonical_json,canonical_sha256,source_artifact_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      revisionId,
      ctx.tenantId,
      invoiceId,
      n,
      canonical.schemaVersion,
      canonical,
      hash,
      sourceId,
    ],
  );
  return {
    invoiceId,
    revisionId,
    revisionNumber: n,
    status: "NORMALIZED",
    canonicalSha256: hash,
    validationSummary: null,
  };
}
export async function ingest(
  ctx: Context,
  canonical: Invoice,
  raw: Buffer,
  key: string,
  mapping: Record<string, unknown> | null = null,
  existingDb?: DB,
) {
  authorize(ctx, ["ADMIN", "OPERATOR"]);
  if (!key || key.length > 200) throw new ApiError("INVALID_REQUEST");
  checkSchema(canonical);
  const work = async (db: DB) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `${ctx.tenantId}/invoices/${key}`,
    ]);
    const hash = sha256(
      stable(
        mapping ? { canonical, sourceSha256: sha256(raw), mapping } : canonical,
      ),
    );
    const old = (
      await db.query(
        "SELECT * FROM idempotency_records WHERE tenant_id=$1 AND route_key=$2 AND idempotency_key=$3",
        [ctx.tenantId, "invoices", key],
      )
    ).rows[0];
    if (old) {
      if (old.request_sha256 !== hash)
        throw new ApiError("IDEMPOTENCY_CONFLICT", 409);
      return old.response_json;
    }
    const id = uid();
    const inserted = await db.query(
      "INSERT INTO invoices(id,tenant_id,environment,source_system,source_record_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id",
      [
        id,
        ctx.tenantId,
        ctx.environment,
        canonical.source.system,
        canonical.source.recordId,
      ],
    );
    if (!inserted.rowCount) {
      const existing = await db.query(
        "SELECT id FROM invoices WHERE tenant_id=$1 AND environment=$2 AND source_system=$3 AND source_record_id=$4",
        [
          ctx.tenantId,
          ctx.environment,
          canonical.source.system,
          canonical.source.recordId,
        ],
      );
      throw new ApiError("SOURCE_DUPLICATE", 409, {
        invoiceId: existing.rows[0]?.id,
      });
    }
    const response = await insertRevision(
      db,
      ctx,
      id,
      1,
      canonical,
      raw,
      mapping,
    );
    await db.query(
      "INSERT INTO idempotency_records(id,tenant_id,route_key,idempotency_key,request_sha256,response_status,response_json) VALUES($1,$2,$3,$4,$5,201,$6)",
      [uid(), ctx.tenantId, "invoices", key, hash, response],
    );
    await audit(db, ctx, "IMPORT", id);
    return response;
  };
  return existingDb ? work(existingDb) : transaction(work);
}
export async function correct(
  ctx: Context,
  invoiceId: string,
  prior: string,
  canonical: Invoice,
  raw: Buffer,
) {
  authorize(ctx, ["ADMIN", "OPERATOR"]);
  checkSchema(canonical);
  return transaction(async (db) => {
    const r = await current(ctx, invoiceId, db, true);
    if (r.id !== prior) throw new ApiError("REVISION_CONFLICT", 409);
    if (
      canonical.source.system !== r.canonical_json.source.system ||
      canonical.source.recordId !== r.canonical_json.source.recordId
    )
      throw new ApiError("INVALID_REQUEST", 400, {
        reason: "Quellidentität darf sich bei einer Korrektur nicht ändern.",
      });
    const result = await insertRevision(
      db,
      ctx,
      invoiceId,
      r.revision_number + 1,
      canonical,
      raw,
    );
    await audit(db, ctx, "CORRECT", invoiceId);
    return result;
  });
}
export function summary(r: any) {
  const i = r.canonical_json as Invoice;
  return {
    invoiceId: r.invoice_id,
    currentRevisionId: r.id,
    revisionNumber: r.revision_number,
    sourceSystem: i.source.system,
    sourceRecordId: i.source.recordId,
    documentNumber: i.document.number,
    buyerName: i.buyer.name,
    issueDate: i.document.issueDate,
    currency: i.document.currency,
    payableAmount: i.totals.payableAmount,
    status: r.status,
    validationResult: r.validation_status ?? null,
    standardResult: r.xml_sha256 ? (r.validation_status ?? null) : null,
    recipientCoverage: r.profile_version_id ? "SYNTHETIC" : "UNKNOWN",
    updatedAt: r.created_at,
  };
}
export async function list(
  ctx: Context,
  status: string | null,
  limit: number,
  cursor: string | null,
) {
  let offset = 0;
  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
      if (
        decoded.tenant !== sha256(ctx.tenantId).slice(0, 12) ||
        decoded.status !== status ||
        !Number.isInteger(decoded.offset) ||
        decoded.offset < 0
      )
        throw Error();
      offset = decoded.offset;
    } catch {
      throw new ApiError("INVALID_REQUEST");
    }
  }
  const rs = (
    await pool.query(
      `SELECT r.*,v.status validation_status,v.profile_version_id,v.xml_sha256 FROM invoice_revisions r LEFT JOIN LATERAL (SELECT status,profile_version_id,xml_sha256 FROM validation_runs WHERE tenant_id=r.tenant_id AND revision_id=r.id ORDER BY created_at DESC LIMIT 1) v ON true WHERE r.tenant_id=$1 AND r.revision_number=(SELECT max(revision_number) FROM invoice_revisions WHERE tenant_id=$1 AND invoice_id=r.invoice_id) AND ($2::text IS NULL OR r.status=$2) ORDER BY r.created_at DESC,r.id LIMIT $3 OFFSET $4`,
      [ctx.tenantId, status, limit + 1, offset],
    )
  ).rows;
  return {
    items: rs.slice(0, limit).map(summary),
    nextCursor:
      rs.length > limit
        ? Buffer.from(
            JSON.stringify({
              tenant: sha256(ctx.tenantId).slice(0, 12),
              status,
              offset: offset + limit,
            }),
          ).toString("base64url")
        : null,
  };
}
export async function detail(ctx: Context, invoiceId: string) {
  const r = await current(ctx, invoiceId);
  const revisions = (
    await pool.query(
      'SELECT id AS "revisionId",revision_number AS "revisionNumber",status,canonical_sha256 AS "canonicalSha256",created_at AS "createdAt" FROM invoice_revisions WHERE tenant_id=$1 AND invoice_id=$2 ORDER BY revision_number DESC',
      [ctx.tenantId, invoiceId],
    )
  ).rows;
  return {
    ...summary(r),
    revisions,
    currentRevision: await revisionDetail(ctx, invoiceId, r.id),
  };
}
export async function revisionDetail(
  ctx: Context,
  invoiceId: string,
  revisionId: string,
) {
  const r = await revision(ctx, invoiceId, revisionId);
  const source = (
    await pool.query(
      'SELECT id,sha256,media_type AS "mediaType" FROM source_artifacts WHERE tenant_id=$1 AND id=$2',
      [ctx.tenantId, r.source_artifact_id],
    )
  ).rows[0];
  const runs = (
    await pool.query(
      "SELECT * FROM validation_runs WHERE tenant_id=$1 AND revision_id=$2 ORDER BY created_at DESC",
      [ctx.tenantId, revisionId],
    )
  ).rows;
  const approvals = (
    await pool.query(
      "SELECT * FROM approvals WHERE tenant_id=$1 AND revision_id=$2 ORDER BY approved_at DESC",
      [ctx.tenantId, revisionId],
    )
  ).rows;
  const artifacts = (
    await pool.query(
      'SELECT id AS "artifactId",sha256,syntax,created_at AS "createdAt",validation_run_id AS "validationRunId" FROM generation_artifacts WHERE tenant_id=$1 AND revision_id=$2',
      [ctx.tenantId, revisionId],
    )
  ).rows;
  return {
    revisionId,
    invoiceId,
    revisionNumber: r.revision_number,
    canonical: r.canonical_json,
    canonicalSha256: r.canonical_sha256,
    sourceArtifact: source,
    status: r.status,
    validationRuns: runs.map(runResponse),
    approval: approvals[0] ?? null,
    artifacts,
  };
}
export function runResponse(r: any) {
  return {
    validationRunId: r.id,
    status: r.status,
    kind: r.kind,
    ruleManifest: r.rule_manifest_json,
    engineVersion: r.engine_version,
    recipientProfileVersionId: r.profile_version_id,
    summary: counts(r.findings),
    findings: r.findings,
    createdAt: r.created_at,
    completedAt: r.completed_at,
    xmlSha256: r.xml_sha256,
  };
}
export async function getRun(ctx: Context, id: string) {
  const r = (
    await pool.query(
      "SELECT * FROM validation_runs WHERE tenant_id=$1 AND id=$2",
      [ctx.tenantId, id],
    )
  ).rows[0];
  if (!r) throw new ApiError("RESOURCE_NOT_FOUND", 404);
  return runResponse(r);
}
export async function enqueueValidation(
  ctx: Context,
  invoiceId: string,
  revisionId: string,
  profileId: string | null,
) {
  authorize(ctx, ["ADMIN", "OPERATOR"]);
  if (profileId && !profiles.some((p) => p.versionId === profileId))
    throw new ApiError("RECIPIENT_PROFILE_UNKNOWN", 404);
  return transaction(async (db) => {
    const latest = await current(ctx, invoiceId, db, true);
    const r = await revision(ctx, invoiceId, revisionId, db);
    const dedupe = sha256(
      stable([
        revisionId,
        r.canonical_sha256,
        profileId,
        ruleManifestHash,
        "VALIDATE",
      ]),
    );
    const old = (
      await db.query(
        "SELECT id FROM validation_runs WHERE tenant_id=$1 AND dedupe_key=$2",
        [ctx.tenantId, dedupe],
      )
    ).rows[0];
    if (old) return { validationRunId: old.id, status: "PENDING" };
    if (
      latest.id !== revisionId ||
      !["NORMALIZED", "INVALID", "BLOCKED_UNSUPPORTED", "VALID"].includes(
        r.status,
      )
    )
      throw new ApiError("REVISION_CONFLICT", 409);
    const id = uid();
    await db.query(
      "INSERT INTO validation_runs(id,tenant_id,revision_id,profile_version_id,rule_manifest_json,engine_version,status,kind,canonical_sha256,dedupe_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        id,
        ctx.tenantId,
        revisionId,
        profileId,
        ruleManifest,
        engineVersion,
        "PENDING",
        "PRECHECK",
        r.canonical_sha256,
        dedupe,
      ],
    );
    await db.query(
      "UPDATE invoice_revisions SET status=$1 WHERE tenant_id=$2 AND id=$3",
      ["VALIDATION_PENDING", ctx.tenantId, revisionId],
    );
    await db.query(
      "INSERT INTO jobs(id,tenant_id,type,dedupe_key,payload_json) VALUES($1,$2,$3,$4,$5)",
      [
        uid(),
        ctx.tenantId,
        "VALIDATE",
        dedupe,
        { invoiceId, revisionId, validationRunId: id, profileId },
      ],
    );
    await audit(db, ctx, "VALIDATE", invoiceId);
    return { validationRunId: id, status: "PENDING" };
  });
}
export async function approve(
  ctx: Context,
  invoiceId: string,
  revisionId: string,
  runId: string,
  profileId: string | null,
) {
  authorize(ctx, ["ADMIN", "APPROVER"]);
  return transaction(async (db) => {
    const r = await current(ctx, invoiceId, db, true);
    if (r.id !== revisionId) throw new ApiError("APPROVAL_STALE", 409);
    const run = (
      await db.query(
        "SELECT * FROM validation_runs WHERE tenant_id=$1 AND revision_id=$2 AND id=$3",
        [ctx.tenantId, revisionId, runId],
      )
    ).rows[0];
    if (
      !run ||
      run.profile_version_id !== profileId ||
      run.canonical_sha256 !== r.canonical_sha256 ||
      sha256(stable(run.rule_manifest_json)) !== ruleManifestHash
    )
      throw new ApiError("APPROVAL_STALE", 409);
    const existing = (
      await db.query(
        "SELECT * FROM approvals WHERE tenant_id=$1 AND revision_id=$2 AND validation_run_id=$3",
        [ctx.tenantId, revisionId, runId],
      )
    ).rows[0];
    if (existing) return approvalResponse(existing);
    const latestRun = (
      await db.query(
        "SELECT id FROM validation_runs WHERE tenant_id=$1 AND revision_id=$2 ORDER BY created_at DESC LIMIT 1",
        [ctx.tenantId, revisionId],
      )
    ).rows[0];
    if (latestRun?.id !== runId) throw new ApiError("APPROVAL_STALE", 409);
    if (
      r.status !== "VALID" ||
      run.status !== "PASS" ||
      counts(run.findings).error
    )
      throw new ApiError("APPROVAL_BLOCKED", 409);
    const a = (
      await db.query(
        "INSERT INTO approvals(id,tenant_id,revision_id,validation_run_id,profile_version_id,approver_subject,canonical_sha256) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
        [
          uid(),
          ctx.tenantId,
          revisionId,
          runId,
          profileId,
          ctx.actor,
          r.canonical_sha256,
        ],
      )
    ).rows[0];
    await db.query(
      "UPDATE invoice_revisions SET status=$1 WHERE tenant_id=$2 AND id=$3",
      ["APPROVED", ctx.tenantId, revisionId],
    );
    await audit(db, ctx, "APPROVE", invoiceId);
    return approvalResponse(a);
  });
}
function approvalResponse(a: any) {
  return {
    approvalId: a.id,
    revisionId: a.revision_id,
    canonicalSha256: a.canonical_sha256,
    approvedAt: a.approved_at,
    approver: a.approver_subject,
  };
}
export async function enqueueGeneration(
  ctx: Context,
  invoiceId: string,
  revisionId: string,
) {
  authorize(ctx, ["ADMIN", "OPERATOR"]);
  return transaction(async (db) => {
    const r = await current(ctx, invoiceId, db, true);
    if (r.id !== revisionId) throw new ApiError("APPROVAL_STALE", 409);
    const a = (
      await db.query(
        "SELECT * FROM approvals WHERE tenant_id=$1 AND revision_id=$2 ORDER BY approved_at DESC LIMIT 1",
        [ctx.tenantId, revisionId],
      )
    ).rows[0];
    if (!a || a.canonical_sha256 !== r.canonical_sha256)
      throw new ApiError("APPROVAL_BLOCKED", 409);
    const dedupe = sha256(
      stable([
        revisionId,
        a.id,
        GENERATOR_VERSION,
        ruleManifestHash,
        "GENERATE",
      ]),
    );
    const old = (
      await db.query(
        "SELECT payload_json FROM jobs WHERE tenant_id=$1 AND dedupe_key=$2",
        [ctx.tenantId, dedupe],
      )
    ).rows[0];
    if (old)
      return {
        validationRunId: old.payload_json.validationRunId,
        status: "PENDING",
      };
    if (r.status !== "APPROVED") throw new ApiError("APPROVAL_BLOCKED", 409);
    const id = uid();
    await db.query(
      "INSERT INTO validation_runs(id,tenant_id,revision_id,profile_version_id,rule_manifest_json,engine_version,status,kind,canonical_sha256,dedupe_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        id,
        ctx.tenantId,
        revisionId,
        a.profile_version_id,
        ruleManifest,
        engineVersion,
        "PENDING",
        "ARTIFACT",
        r.canonical_sha256,
        dedupe,
      ],
    );
    await db.query(
      "INSERT INTO jobs(id,tenant_id,type,dedupe_key,payload_json) VALUES($1,$2,$3,$4,$5)",
      [
        uid(),
        ctx.tenantId,
        "GENERATE",
        dedupe,
        {
          invoiceId,
          revisionId,
          validationRunId: id,
          approvalId: a.id,
          profileId: a.profile_version_id,
        },
      ],
    );
    await db.query(
      "UPDATE invoice_revisions SET status=$1 WHERE tenant_id=$2 AND id=$3",
      ["GENERATION_PENDING", ctx.tenantId, revisionId],
    );
    await audit(db, ctx, "GENERATE", invoiceId);
    return { validationRunId: id, status: "PENDING" };
  });
}
export async function artifact(ctx: Context, id: string) {
  const a = (
    await pool.query(
      "SELECT a.*,r.invoice_id,v.status validation_status FROM generation_artifacts a JOIN invoice_revisions r ON r.id=a.revision_id AND r.tenant_id=a.tenant_id JOIN validation_runs v ON v.id=a.validation_run_id AND v.tenant_id=a.tenant_id WHERE a.tenant_id=$1 AND a.id=$2",
      [ctx.tenantId, id],
    )
  ).rows[0];
  if (!a) throw new ApiError("RESOURCE_NOT_FOUND", 404);
  if (sha256(a.bytes) !== a.sha256)
    throw new ApiError("ARTIFACT_HASH_MISMATCH", 500);
  return a;
}
export async function evidence(
  ctx: Context,
  invoiceId: string,
  revisionId?: string | null,
) {
  const r = revisionId
    ? await revision(ctx, invoiceId, revisionId)
    : await current(ctx, invoiceId);
  const manifest = (
    await pool.query(
      "SELECT manifest FROM evidence_manifests WHERE tenant_id=$1 AND revision_id=$2 ORDER BY created_at DESC LIMIT 1",
      [ctx.tenantId, r.id],
    )
  ).rows[0];
  if (!manifest) throw new ApiError("RESOURCE_NOT_FOUND", 404);
  return manifest.manifest;
}
export async function processJob(): Promise<boolean> {
  const job = await transaction(
    async (db) =>
      (
        await db.query(
          `UPDATE jobs SET state='RUNNING',attempts=attempts+1,lease_until=now()+interval '120 seconds' WHERE id=(SELECT id FROM jobs WHERE (state='PENDING' AND available_at<=now()) OR (state='RUNNING' AND lease_until<now()) ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
        )
      ).rows[0],
  );
  if (!job) return false;
  const ctx: Context = {
    tenantId: job.tenant_id,
    actor: "worker",
    role: "ADMIN",
    environment: "LOCAL",
    requestId: job.id,
  };
  const p = job.payload_json;
  try {
    const r = await revision(ctx, p.invoiceId, p.revisionId);
    const run = (
      await pool.query(
        "SELECT * FROM validation_runs WHERE tenant_id=$1 AND id=$2 AND revision_id=$3",
        [ctx.tenantId, p.validationRunId, p.revisionId],
      )
    ).rows[0];
    if (!run) throw Error("INTERNAL_ERROR");
    if (run.status === "PASS" || run.status === "FAIL") {
      await pool.query(
        "UPDATE jobs SET state='DONE',lease_until=NULL WHERE tenant_id=$1 AND id=$2",
        [ctx.tenantId, job.id],
      );
      return true;
    }
    let fs = semanticFindings(r.canonical_json, p.profileId);
    const unsupported = fs.some((f) => f.code === "UNSUPPORTED_CASE");
    let xml: string | null = null,
      report: string | null = null;
    let officialPass = false;
    if (!counts(fs).error) {
      xml = generateUbl(r.canonical_json);
      const result = await officialValidate(xml);
      report = result.rawReport;
      officialPass = result.pass;
      fs = [...fs, ...result.findings];
    }
    const sourceMapping = (
      await pool.query(
        "SELECT mapping_json FROM source_artifacts WHERE tenant_id=$1 AND id=$2",
        [ctx.tenantId, r.source_artifact_id],
      )
    ).rows[0]?.mapping_json;
    if (sourceMapping)
      fs = fs.map((f) => {
        const origin = sourceMapping.provenance[f.canonicalPath];
        return origin
          ? { ...f, sourcePath: `row ${origin.row}, column ${origin.column}` }
          : f;
      });
    const pass = officialPass && !counts(fs).error;
    await transaction(async (db) => {
      const locked = (
        await db.query(
          "SELECT * FROM jobs WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
          [ctx.tenantId, job.id],
        )
      ).rows[0];
      if (locked.state !== "RUNNING" || locked.attempts !== job.attempts)
        return;
      await db.query(
        "UPDATE validation_runs SET status=$1,findings=$2,raw_report=$3,xml_sha256=$4,completed_at=now() WHERE tenant_id=$5 AND id=$6",
        [
          pass ? "PASS" : "FAIL",
          JSON.stringify(fs),
          report,
          xml ? sha256(xml) : null,
          ctx.tenantId,
          p.validationRunId,
        ],
      );
      for (const f of fs)
        await db.query(
          "INSERT INTO validation_findings(id,tenant_id,validation_run_id,stable_code,severity,layer,canonical_path,source_path,external_rule_id,message_key,parameters_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
          [
            uid(),
            ctx.tenantId,
            p.validationRunId,
            f.code,
            f.severity,
            f.layer,
            f.canonicalPath,
            f.sourcePath,
            f.ruleId,
            f.messageKey,
            f.parameters,
          ],
        );
      let a: any = null;
      if (job.type === "GENERATE" && xml) {
        a = { id: uid(), sha256: sha256(xml) };
        await db.query(
          "INSERT INTO generation_artifacts(id,tenant_id,revision_id,approval_id,syntax,profile,generator_version,object_key,sha256,bytes,validation_run_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
          [
            a.id,
            ctx.tenantId,
            p.revisionId,
            p.approvalId,
            "XRECHNUNG_UBL",
            "XRechnung 3.0.2",
            GENERATOR_VERSION,
            `xml/${a.id}`,
            a.sha256,
            Buffer.from(xml),
            p.validationRunId,
          ],
        );
      }
      const status = unsupported
        ? "BLOCKED_UNSUPPORTED"
        : !pass
          ? "INVALID"
          : job.type === "GENERATE"
            ? "ARTIFACT_VALIDATED"
            : "VALID";
      await db.query(
        "UPDATE invoice_revisions SET status=$1 WHERE tenant_id=$2 AND id=$3",
        [status, ctx.tenantId, p.revisionId],
      );
      const source = (
        await db.query(
          "SELECT sha256,mapping_json FROM source_artifacts WHERE tenant_id=$1 AND id=$2",
          [ctx.tenantId, r.source_artifact_id],
        )
      ).rows[0];
      const manifest = {
        manifestVersion: "fakturapass.evidence.v1",
        tenantId: ctx.tenantId,
        invoiceId: p.invoiceId,
        revisionId: p.revisionId,
        source: {
          sha256: source.sha256,
          ...(source.mapping_json ? { mapping: source.mapping_json } : {}),
        },
        canonical: {
          schemaVersion: r.schema_version,
          sha256: r.canonical_sha256,
        },
        generation: a
          ? {
              artifactId: a.id,
              syntax: "XRECHNUNG_UBL",
              generatorVersion: GENERATOR_VERSION,
              sha256: a.sha256,
            }
          : null,
        validation: {
          runId: p.validationRunId,
          engineVersion,
          ruleManifestSha256: ruleManifestHash,
          status: pass ? "PASS" : "FAIL",
          findingCounts: counts(fs),
          ruleManifest,
          findings: fs,
          reportSha256: report ? sha256(report) : null,
          rawReport: report,
        },
        recipientProfile: {
          versionId: p.profileId,
          status: p.profileId ? "SYNTHETIC" : "UNKNOWN",
        },
        createdAt: new Date().toISOString(),
      };
      await db.query(
        "INSERT INTO evidence_manifests(id,tenant_id,revision_id,validation_run_id,manifest,sha256) VALUES($1,$2,$3,$4,$5,$6)",
        [
          uid(),
          ctx.tenantId,
          p.revisionId,
          p.validationRunId,
          manifest,
          sha256(stable(manifest)),
        ],
      );
      await db.query(
        "UPDATE jobs SET state='DONE',lease_until=NULL,last_error_code=NULL WHERE tenant_id=$1 AND id=$2",
        [ctx.tenantId, job.id],
      );
      await audit(db, ctx, `COMPLETED_${job.type}`, p.invoiceId);
    });
  } catch {
    await transaction(async (db) => {
      await db.query(
        "UPDATE jobs SET state='PENDING',available_at=now()+interval '5 seconds',lease_until=NULL,last_error_code='ENGINE_UNAVAILABLE' WHERE tenant_id=$1 AND id=$2 AND attempts=$3",
        [ctx.tenantId, job.id, job.attempts],
      );
      await db.query(
        "UPDATE validation_runs SET status='ERROR',findings=$1 WHERE tenant_id=$2 AND id=$3 AND status IN ('PENDING','ERROR')",
        [
          JSON.stringify([
            {
              code: "ENGINE_UNAVAILABLE",
              severity: "ERROR",
              layer: "SYSTEM",
              canonicalPath: "",
              sourcePath: null,
              ruleId: null,
              messageKey: "ENGINE_UNAVAILABLE",
              parameters: { retrying: true },
              evidenceSource: null,
            },
          ]),
          ctx.tenantId,
          p.validationRunId,
        ],
      );
    });
    console.error(
      JSON.stringify({
        level: "error",
        service: "worker",
        jobId: job.id,
        code: "ENGINE_UNAVAILABLE",
      }),
    );
  }
  return true;
}
