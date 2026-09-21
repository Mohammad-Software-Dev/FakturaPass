import { randomUUID } from "node:crypto";
import { pool, transaction, type DB } from "../database";
import { ApiError, type Context } from "../domain/service";
import { resolveMembership } from "./memberships";
import { settings, principalActor } from "./oidc";

const selection = `SELECT g.*,a.display_name AS agent_name,a.actor_subject AS agent_actor,a.status AS agent_status,m.role AS authorizer_role,m.status AS authorizer_status,EXISTS(SELECT 1 FROM memberships blocked WHERE blocked.tenant_id=g.tenant_id AND blocked.user_subject=a.actor_subject AND blocked.status='SUSPENDED') AS agent_membership_suspended,t.name AS workspace_name,r.revision_number,r.canonical_json->'document'->>'number' AS invoice_number FROM support_grants g JOIN support_agents a ON a.id=g.agent_id JOIN memberships m ON m.tenant_id=g.tenant_id AND m.user_subject=g.created_by JOIN tenants t ON t.id=g.tenant_id JOIN invoice_revisions r ON r.id=g.revision_id AND r.invoice_id=g.invoice_id AND r.tenant_id=g.tenant_id`;
function status(row: any) {
  const s = settings();
  return row.revoked_at
    ? "REVOKED"
    : row.expires_at <= new Date()
      ? "EXPIRED"
      : row.authority_sha256 !== s.authority ||
          row.environment !== s.environment ||
          row.agent_status !== "ACTIVE" ||
          row.agent_membership_suspended ||
          row.authorizer_status !== "ACTIVE" ||
          row.authorizer_role !== "ADMIN"
        ? "UNAVAILABLE"
        : "ACTIVE";
}
function present(row: any) {
  return {
    id: row.id,
    agentName: row.agent_name,
    workspaceName: row.workspace_name,
    invoiceNumber: row.invoice_number,
    revisionNumber: row.revision_number,
    scope: row.scope,
    reason: row.reason,
    status: status(row),
    expiresAt: row.expires_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    lastViewedAt: row.last_viewed_at?.toISOString() ?? null,
  };
}
async function audit(
  db: DB,
  tenant: string,
  actor: string,
  id: string,
  action: string,
  requestId: string,
  metadata: object = {},
) {
  await db.query(
    "INSERT INTO audit_events(id,tenant_id,actor_subject,action,resource_type,resource_id,request_id,metadata_json) VALUES($1,$2,$3,$4,'support_grant',$5,$6,$7)",
    [randomUUID(), tenant, actor, action, id, requestId, metadata],
  );
}
async function admin(ctx: Context, db: DB = pool) {
  if ((await resolveMembership(ctx.tenantId, ctx.actor, db)) !== "ADMIN")
    throw new ApiError("ACCESS_DENIED", 403);
}
export async function registerSupportAgent(
  issuer: string,
  subject: string,
  name: string,
) {
  const s = settings();
  if (
    issuer !== s.issuer.href ||
    !subject ||
    subject.length > 255 ||
    !name?.trim() ||
    name.trim().length > 120
  )
    throw new ApiError("INVALID_REQUEST");
  return transaction(async (db) => {
    const id = randomUUID();
    await db.query(
      "INSERT INTO support_agents(id,actor_subject,authority_sha256,display_name) VALUES($1,$2,$3,$4)",
      [id, principalActor(issuer, subject), s.authority, name.trim()],
    );
    await db.query(
      "INSERT INTO support_agent_events(id,agent_id,action,actor_subject) VALUES($1,$2,'REGISTER','provisioning-cli')",
      [randomUUID(), id],
    );
    return { id };
  });
}
export async function suspendSupportAgent(id: string) {
  return transaction(async (db) => {
    const row = (
      await db.query(
        "UPDATE support_agents SET status='SUSPENDED' WHERE id=$1 AND authority_sha256=$2 RETURNING id",
        [id, settings().authority],
      )
    ).rows[0];
    if (!row) throw new ApiError("RESOURCE_NOT_FOUND", 404);
    const grants = (
      await db.query(
        "UPDATE support_grants SET revoked_at=now() WHERE agent_id=$1 AND revoked_at IS NULL RETURNING *",
        [id],
      )
    ).rows;
    for (const grant of grants)
      await audit(
        db,
        grant.tenant_id,
        "provisioning-cli",
        grant.id,
        "SUPPORT_GRANT_REVOKE",
        randomUUID(),
        { reason: "AGENT_SUSPENDED" },
      );
    await db.query(
      "INSERT INTO support_agent_events(id,agent_id,action,actor_subject) VALUES($1,$2,'SUSPEND','provisioning-cli')",
      [randomUUID(), id],
    );
  });
}
export async function listSupportAgents(ctx: Context) {
  await admin(ctx);
  return {
    items: (
      await pool.query(
        "SELECT id,display_name AS name FROM support_agents WHERE authority_sha256=$1 AND status='ACTIVE' ORDER BY display_name,id",
        [settings().authority],
      )
    ).rows,
  };
}
export async function listSupportGrants(ctx: Context) {
  await admin(ctx);
  return {
    items: (
      await pool.query(
        selection + " WHERE g.tenant_id=$1 ORDER BY g.created_at DESC,g.id",
        [ctx.tenantId],
      )
    ).rows.map(present),
  };
}
export async function createSupportGrant(ctx: Context, input: any) {
  if (
    !input ||
    typeof input.agentId !== "string" ||
    typeof input.invoiceId !== "string" ||
    typeof input.revisionId !== "string" ||
    typeof input.reason !== "string" ||
    !input.reason.trim() ||
    input.reason.trim().length > 500 ||
    !Number.isInteger(input.hours) ||
    input.hours < 1 ||
    input.hours > 24 ||
    input.consent !== true ||
    Object.keys(input).some(
      (k) =>
        ![
          "agentId",
          "invoiceId",
          "revisionId",
          "reason",
          "hours",
          "consent",
        ].includes(k),
    )
  )
    throw new ApiError("INVALID_REQUEST");
  const s = settings();
  return transaction(async (db) => {
    await db.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
      ctx.tenantId,
    ]);
    await admin(ctx, db);
    const agent = (
      await db.query(
        "SELECT id,actor_subject FROM support_agents WHERE id=$1 AND authority_sha256=$2 AND status='ACTIVE' FOR SHARE",
        [input.agentId, s.authority],
      )
    ).rows[0];
    if (!agent) throw new ApiError("RESOURCE_NOT_FOUND", 404);
    if (
      (
        await db.query(
          "SELECT 1 FROM memberships WHERE tenant_id=$1 AND user_subject=$2 AND status='SUSPENDED'",
          [ctx.tenantId, agent.actor_subject],
        )
      ).rowCount
    )
      throw new ApiError("ACCESS_DENIED", 403);
    const revision = (
      await db.query(
        "SELECT r.id FROM invoice_revisions r JOIN invoices i ON i.id=r.invoice_id AND i.tenant_id=r.tenant_id WHERE r.tenant_id=$1 AND r.invoice_id=$2 AND i.environment=$3 AND r.id=$4",
        [ctx.tenantId, input.invoiceId, s.environment, input.revisionId],
      )
    ).rows[0];
    if (!revision) throw new ApiError("RESOURCE_NOT_FOUND", 404);
    const id = randomUUID();
    await db.query(
      "INSERT INTO support_grants(id,tenant_id,agent_id,authority_sha256,environment,invoice_id,revision_id,reason,created_by,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now()+$10*interval '1 hour')",
      [
        id,
        ctx.tenantId,
        agent.id,
        s.authority,
        s.environment,
        input.invoiceId,
        revision.id,
        input.reason.trim(),
        ctx.actor,
        input.hours,
      ],
    );
    await audit(
      db,
      ctx.tenantId,
      ctx.actor,
      id,
      "SUPPORT_GRANT_CREATE",
      ctx.requestId,
      {
        agentId: agent.id,
        invoiceId: input.invoiceId,
        revisionId: revision.id,
        hours: input.hours,
        scope: "INVOICE_DIAGNOSIS",
        consent: true,
      },
    );
    return present(
      (await db.query(selection + " WHERE g.id=$1", [id])).rows[0],
    );
  });
}
export async function revokeSupportGrant(ctx: Context, id: string) {
  return transaction(async (db) => {
    await db.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
      ctx.tenantId,
    ]);
    await admin(ctx, db);
    const row = (
      await db.query(
        "SELECT * FROM support_grants WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
        [ctx.tenantId, id],
      )
    ).rows[0];
    if (!row) throw new ApiError("RESOURCE_NOT_FOUND", 404);
    if (!row.revoked_at) {
      await db.query("UPDATE support_grants SET revoked_at=now() WHERE id=$1", [
        id,
      ]);
      await audit(
        db,
        ctx.tenantId,
        ctx.actor,
        id,
        "SUPPORT_GRANT_REVOKE",
        ctx.requestId,
      );
    }
    return present(
      (await db.query(selection + " WHERE g.id=$1", [id])).rows[0],
    );
  });
}
export async function activeSupportGrants(actor: string, db: DB = pool) {
  const s = settings();
  return (
    await db.query(
      selection +
        " WHERE a.actor_subject=$1 AND a.authority_sha256=$2 AND g.authority_sha256=$2 AND g.environment=$3 AND g.revoked_at IS NULL AND g.expires_at>now() AND a.status='ACTIVE' AND m.status='ACTIVE' AND m.role='ADMIN' AND NOT EXISTS(SELECT 1 FROM memberships blocked WHERE blocked.tenant_id=g.tenant_id AND blocked.user_subject=a.actor_subject AND blocked.status='SUSPENDED') ORDER BY g.created_at DESC,g.id",
      [actor, s.authority, s.environment],
    )
  ).rows;
}
export async function supportCases(actor: string, requestId: string) {
  return transaction(async (db) => {
    const rows = await activeSupportGrants(actor, db);
    for (const row of rows)
      await audit(
        db,
        row.tenant_id,
        actor,
        row.id,
        "SUPPORT_CASE_LIST",
        requestId,
      );
    return { items: rows.map(present) };
  });
}
export async function supportDiagnosis(
  actor: string,
  id: string,
  requestId: string,
) {
  return transaction(async (db) => {
    const row = (
      await db.query(
        selection +
          " WHERE g.id=$1 AND a.actor_subject=$2 AND g.expires_at>now() AND g.revoked_at IS NULL FOR UPDATE OF g",
        [id, actor],
      )
    ).rows[0];
    if (!row || status(row) !== "ACTIVE")
      throw new ApiError("ACCESS_DENIED", 403);
    const revision = (
      await db.query(
        "SELECT canonical_json,canonical_sha256,status FROM invoice_revisions WHERE id=$1 AND invoice_id=$2 AND tenant_id=$3",
        [row.revision_id, row.invoice_id, row.tenant_id],
      )
    ).rows[0];
    const runs = (
      await db.query(
        'SELECT id,status,kind,findings,engine_version AS "engineVersion",created_at AS "createdAt" FROM validation_runs WHERE tenant_id=$1 AND revision_id=$2 ORDER BY created_at DESC',
        [row.tenant_id, row.revision_id],
      )
    ).rows;
    // Audit and return the explicitly shared projection; no general Context or customer membership is granted.
    await db.query(
      "UPDATE support_grants SET last_viewed_at=now() WHERE id=$1",
      [id],
    );
    await audit(
      db,
      row.tenant_id,
      actor,
      id,
      "SUPPORT_DIAGNOSIS_VIEW",
      requestId,
      { revisionId: row.revision_id, scope: row.scope },
    );
    return {
      grant: present(row),
      revision: {
        canonical: revision.canonical_json,
        sha256: revision.canonical_sha256,
        status: revision.status,
      },
      validationRuns: runs,
    };
  });
}
