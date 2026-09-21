import { randomBytes, randomUUID } from "node:crypto";
import { pool, transaction, type DB } from "../database";
import { sha256 } from "../domain";
import { ApiError, type Context } from "../domain/service";
import { roles, resolveMembership } from "./memberships";
export function invitationEmail(value: unknown) {
  if (typeof value !== "string" || value.length > 254)
    throw new ApiError("INVALID_REQUEST");
  const email = value.trim();
  if (
    !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(
      email,
    )
  )
    throw new ApiError("INVALID_REQUEST");
  const at = email.lastIndexOf("@");
  return email.slice(0, at) + "@" + email.slice(at + 1).toLowerCase();
}
async function admin(db: DB, ctx: Context) {
  if ((await resolveMembership(ctx.tenantId, ctx.actor, db)) !== "ADMIN")
    throw new ApiError("ACCESS_DENIED", 403);
}
async function audit(
  db: DB,
  ctx: Context,
  id: string,
  action: string,
  metadata: unknown = {},
) {
  await db.query(
    "INSERT INTO audit_events(id,tenant_id,actor_subject,action,resource_type,resource_id,request_id,metadata_json) VALUES($1,$2,$3,$4,'invitation',$5,$6,$7)",
    [
      randomUUID(),
      ctx.tenantId,
      ctx.actor,
      action,
      id,
      ctx.requestId,
      metadata,
    ],
  );
}
export async function createInvitation(
  ctx: Context,
  input: { email: string; role: Context["role"] },
  authority: string,
) {
  if (
    !input ||
    !roles.includes(input.role) ||
    Object.keys(input).some((k) => !["email", "role"].includes(k))
  )
    throw new ApiError("INVALID_REQUEST");
  const email = invitationEmail(input.email),
    token = randomBytes(32).toString("base64url"),
    id = randomUUID();
  return transaction(async (db) => {
    await db.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
      ctx.tenantId,
    ]);
    await admin(db, ctx);
    const replaced = (
      await db.query(
        "UPDATE organization_invitations SET status='REVOKED' WHERE tenant_id=$1 AND email=$2 AND status='PENDING' RETURNING id",
        [ctx.tenantId, email],
      )
    ).rows;
    for (const prior of replaced)
      await audit(db, ctx, prior.id, "INVITATION_REVOKE", {
        reason: "replaced",
      });
    const row = (
      await db.query(
        "INSERT INTO organization_invitations(id,tenant_id,authority_sha256,email,role,token_sha256,created_by,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '72 hours') RETURNING expires_at",
        [
          id,
          ctx.tenantId,
          authority,
          email,
          input.role,
          sha256(token),
          ctx.actor,
        ],
      )
    ).rows[0];
    await audit(db, ctx, id, "INVITATION_CREATE", {
      role: input.role,
      emailSha256: sha256(email),
    });
    return { id, token, expiresAt: row.expires_at.toISOString() };
  });
}
export async function listInvitations(ctx: Context, authority: string) {
  await admin(pool, ctx);
  const rows = (
    await pool.query(
      "SELECT i.*, EXISTS(SELECT 1 FROM memberships m WHERE m.tenant_id=i.tenant_id AND m.user_subject=i.created_by AND m.status='ACTIVE' AND m.role='ADMIN') AS issuer_active FROM organization_invitations i WHERE i.tenant_id=$1 ORDER BY i.created_at DESC",
      [ctx.tenantId],
    )
  ).rows;
  return {
    items: rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      expiresAt: row.expires_at.toISOString(),
      status:
        row.status !== "PENDING"
          ? row.status
          : row.expires_at <= new Date()
            ? "EXPIRED"
            : row.authority_sha256 !== authority || !row.issuer_active
              ? "UNAVAILABLE"
              : "PENDING",
    })),
  };
}
export async function revokeInvitation(ctx: Context, id: string) {
  return transaction(async (db) => {
    await db.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
      ctx.tenantId,
    ]);
    await admin(db, ctx);
    const row = (
      await db.query(
        "SELECT status FROM organization_invitations WHERE id=$1 AND tenant_id=$2",
        [id, ctx.tenantId],
      )
    ).rows[0];
    if (!row) throw new ApiError("RESOURCE_NOT_FOUND", 404);
    if (row.status === "ACCEPTED") throw new ApiError("REVISION_CONFLICT", 409);
    if (row.status !== "REVOKED") {
      await db.query(
        "UPDATE organization_invitations SET status='REVOKED' WHERE id=$1",
        [id],
      );
      await audit(db, ctx, id, "INVITATION_REVOKE");
    }
    return { id, status: "REVOKED" };
  });
}
export async function invitationPreview(token: unknown, authority: string) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new ApiError("INVITATION_INVALID", 403);
  const row = (
    await pool.query(
      "SELECT i.id,i.email,i.role,i.expires_at,t.name FROM organization_invitations i JOIN tenants t ON t.id=i.tenant_id JOIN memberships m ON m.tenant_id=i.tenant_id AND m.user_subject=i.created_by WHERE i.token_sha256=$1 AND i.authority_sha256=$2 AND i.status='PENDING' AND i.expires_at>now() AND m.role='ADMIN' AND m.status='ACTIVE'",
      [sha256(token), authority],
    )
  ).rows[0];
  if (!row) throw new ApiError("INVITATION_INVALID", 403);
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    organization: row.name,
    expiresAt: row.expires_at.toISOString(),
  };
}
export async function acceptInvitation(
  db: DB,
  id: string,
  authority: string,
  actor: string,
  claims: Record<string, unknown>,
  environment: string,
) {
  const candidate = (
    await db.query(
      "SELECT tenant_id FROM organization_invitations WHERE id=$1",
      [id],
    )
  ).rows[0];
  if (!candidate) throw new ApiError("INVITATION_INVALID", 403);
  await db.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
    candidate.tenant_id,
  ]);
  const row = (
    await db.query(
      "SELECT * FROM organization_invitations WHERE id=$1 AND authority_sha256=$2 AND status='PENDING' AND expires_at>now()",
      [id, authority],
    )
  ).rows[0];
  if (
    !row ||
    claims.email_verified !== true ||
    typeof claims.email !== "string"
  )
    throw new ApiError("INVITATION_INVALID", 403);
  let email;
  try {
    email = invitationEmail(claims.email);
  } catch {
    throw new ApiError("INVITATION_INVALID", 403);
  }
  if (
    email !== row.email ||
    (await resolveMembership(row.tenant_id, row.created_by, db)) !== "ADMIN"
  )
    throw new ApiError("INVITATION_INVALID", 403);
  const prior = (
    await db.query(
      "SELECT role,status FROM memberships WHERE tenant_id=$1 AND user_subject=$2",
      [row.tenant_id, actor],
    )
  ).rows[0];
  if (prior && prior.status !== "ACTIVE")
    throw new ApiError("INVITATION_INVALID", 403);
  if (!prior)
    await db.query(
      "INSERT INTO memberships(id,tenant_id,user_subject,role,status) VALUES($1,$2,$3,$4,'ACTIVE')",
      [randomUUID(), row.tenant_id, actor, row.role],
    );
  await db.query(
    "UPDATE organization_invitations SET status='ACCEPTED',accepted_by=$2,accepted_at=now() WHERE id=$1",
    [id, actor],
  );
  await audit(
    db,
    {
      tenantId: row.tenant_id,
      actor,
      role: prior?.role ?? row.role,
      environment,
      requestId: randomUUID(),
    },
    id,
    "INVITATION_ACCEPT",
    { role: prior?.role ?? row.role, membershipCreated: !prior },
  );
}
