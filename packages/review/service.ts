import { randomUUID } from "node:crypto";
import { pool, transaction, type DB } from "../database";
import { ApiError, authorize, type Context } from "../domain/service";
import { sha256 } from "../domain";
import * as recipients from "../recipients/service";
import { coverage } from "../recipients/model";
import { reviewReasons, reasons } from "./model";
export async function list(
  ctx: Context,
  options: {
    owner?: string;
    reason?: string;
    limit?: number;
    cursor?: string;
  } = {},
) {
  const owner = options.owner ?? "all",
    reason = options.reason ?? "",
    limit = options.limit ?? 50;
  if (
    !["all", "mine", "unassigned"].includes(owner) ||
    (reason && !reasons.includes(reason as any)) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new ApiError("INVALID_REQUEST");
  let offset = 0;
  const scope = sha256(`${ctx.tenantId}/${ctx.actor}/${owner}/${reason}`);
  if (options.cursor)
    try {
      const c = JSON.parse(Buffer.from(options.cursor, "base64url").toString());
      if (c.scope !== scope || !Number.isSafeInteger(c.offset) || c.offset < 0)
        throw Error();
      offset = c.offset;
    } catch {
      throw new ApiError("INVALID_REQUEST");
    }
  const profiles = await recipients.list(ctx);
  const current = new Map(profiles.map((p) => [p.recipientKey, p.versionId]));
  const rows = (
    await pool.query(
      `SELECT r.*,v.status validation_status,v.profile_version_id,v.recipient_snapshot,a.owner_subject,a.version assignment_version,a.updated_at assignment_updated_at FROM invoices i JOIN LATERAL (SELECT * FROM invoice_revisions WHERE tenant_id=i.tenant_id AND invoice_id=i.id ORDER BY revision_number DESC LIMIT 1) r ON true LEFT JOIN LATERAL (SELECT status,profile_version_id,recipient_snapshot FROM validation_runs WHERE tenant_id=r.tenant_id AND revision_id=r.id ORDER BY created_at DESC,id DESC LIMIT 1) v ON true LEFT JOIN review_assignments a ON a.tenant_id=i.tenant_id AND a.invoice_id=i.id WHERE i.tenant_id=$1`,
      [ctx.tenantId],
    )
  ).rows;
  const all = rows
    .map((r) => {
      const invoice = r.canonical_json;
      const p =
        r.recipient_snapshot?.profile ??
        profiles.find((p) => p.versionId === r.profile_version_id) ??
        null;
      const recipientCoverage = coverage(
        p
          ? { ...p, current: current.get(p.recipientKey) === p.versionId }
          : null,
        invoice,
      );
      const rs = reviewReasons(
        r.status,
        r.validation_status,
        recipientCoverage,
      );
      return {
        invoiceId: r.invoice_id,
        revisionId: r.id,
        revisionNumber: r.revision_number,
        documentNumber: invoice.document.number,
        buyerName: invoice.buyer.name,
        sourceRecordId: invoice.source.recordId,
        payableAmount: invoice.totals.payableAmount,
        currency: invoice.document.currency,
        status: r.status,
        recipientCoverage,
        reasons: rs,
        priority: Math.min(...rs.map((x) => reasons.indexOf(x as any))),
        createdAt: r.created_at.toISOString(),
        assignment: {
          owner: r.owner_subject ?? null,
          version: r.assignment_version ?? 0,
          updatedAt: r.assignment_updated_at?.toISOString() ?? null,
          isMine: r.owner_subject === ctx.actor,
        },
      };
    })
    .filter((i) => i.reasons.length > 0)
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.invoiceId.localeCompare(b.invoiceId),
    );
  const filtered = all.filter(
    (i) =>
      (owner !== "mine" || i.assignment.isMine) &&
      (owner !== "unassigned" || !i.assignment.owner) &&
      (!reason || i.reasons.includes(reason)),
  );
  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
    counts: {
      all: all.length,
      mine: all.filter((i) => i.assignment.isMine).length,
      unassigned: all.filter((i) => !i.assignment.owner).length,
    },
    nextCursor:
      offset + limit < filtered.length
        ? Buffer.from(
            JSON.stringify({ scope, offset: offset + limit }),
          ).toString("base64url")
        : null,
    canManage: ctx.role !== "READ_ONLY",
  };
}
async function assignment(db: DB, ctx: Context, invoiceId: string) {
  const row = (
    await db.query(
      "SELECT * FROM review_assignments WHERE tenant_id=$1 AND invoice_id=$2",
      [ctx.tenantId, invoiceId],
    )
  ).rows[0];
  return {
    owner: row?.owner_subject ?? null,
    version: row?.version ?? 0,
    updatedAt: row?.updated_at?.toISOString() ?? null,
    isMine: row?.owner_subject === ctx.actor,
  };
}
export async function assign(
  ctx: Context,
  invoiceId: string,
  input: {
    action: "CLAIM" | "RELEASE";
    expectedRevisionId: string;
    expectedVersion: number;
  },
) {
  authorize(ctx, ["ADMIN", "OPERATOR", "APPROVER"]);
  if (
    !input ||
    !["CLAIM", "RELEASE"].includes(input.action) ||
    typeof input.expectedRevisionId !== "string" ||
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 0 ||
    Object.keys(input).some(
      (k) => !["action", "expectedRevisionId", "expectedVersion"].includes(k),
    )
  )
    throw new ApiError("INVALID_REQUEST");
  return transaction(async (db) => {
    const locked = (
      await db.query(
        "SELECT id FROM invoices WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
        [ctx.tenantId, invoiceId],
      )
    ).rows[0];
    if (!locked) throw new ApiError("RESOURCE_NOT_FOUND", 404);
    const revision = (
      await db.query(
        "SELECT id,status FROM invoice_revisions WHERE tenant_id=$1 AND invoice_id=$2 ORDER BY revision_number DESC LIMIT 1",
        [ctx.tenantId, invoiceId],
      )
    ).rows[0];
    const previous = await assignment(db, ctx, invoiceId);
    if (
      revision.id !== input.expectedRevisionId ||
      previous.version !== input.expectedVersion
    )
      throw new ApiError("REVISION_CONFLICT", 409);
    if (
      input.action === "CLAIM" &&
      previous.owner &&
      previous.owner !== ctx.actor
    )
      throw new ApiError("REVISION_CONFLICT", 409);
    if (
      input.action === "RELEASE" &&
      previous.owner &&
      previous.owner !== ctx.actor &&
      ctx.role !== "ADMIN"
    )
      throw new ApiError("ACCESS_DENIED", 403);
    const owner = input.action === "CLAIM" ? ctx.actor : null;
    if (owner === previous.owner) return previous;
    await db.query(
      "INSERT INTO review_assignments(tenant_id,invoice_id,owner_subject,version) VALUES($1,$2,$3,1) ON CONFLICT(tenant_id,invoice_id) DO UPDATE SET owner_subject=$3,version=review_assignments.version+1,updated_at=now()",
      [ctx.tenantId, invoiceId, owner],
    );
    await db.query(
      "INSERT INTO audit_events(id,tenant_id,actor_subject,action,resource_type,resource_id,request_id,metadata_json) VALUES($1,$2,$3,$4,'invoice',$5,$6,$7)",
      [
        randomUUID(),
        ctx.tenantId,
        ctx.actor,
        `REVIEW_${input.action}`,
        invoiceId,
        ctx.requestId,
        { priorOwner: previous.owner, owner, revisionId: revision.id },
      ],
    );
    return assignment(db, ctx, invoiceId);
  });
}
