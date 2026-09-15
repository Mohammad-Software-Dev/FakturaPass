import { randomUUID } from "node:crypto";
import { pool, transaction, type DB } from "../database";
import { ApiError, type Context } from "../domain/service";
export const roles = ["ADMIN", "OPERATOR", "APPROVER", "READ_ONLY"] as const;
export async function resolveMembership(
  tenantId: string,
  actor: string,
  db: DB = pool,
) {
  const row = (
    await db.query(
      "SELECT role,status FROM memberships WHERE tenant_id=$1 AND user_subject=$2",
      [tenantId, actor],
    )
  ).rows[0];
  if (!row || row.status !== "ACTIVE" || !roles.includes(row.role))
    throw new ApiError("ACCESS_DENIED", 403);
  return row.role as Context["role"];
}
function present(row: any) {
  return {
    id: row.id,
    subject: row.user_subject,
    role: row.role,
    status: row.status,
    version: row.version,
    updatedAt: row.updated_at.toISOString(),
  };
}
async function requireAdmin(ctx: Context, db: DB = pool) {
  if ((await resolveMembership(ctx.tenantId, ctx.actor, db)) !== "ADMIN")
    throw new ApiError("ACCESS_DENIED", 403);
}
export async function listMembers(ctx: Context) {
  await requireAdmin(ctx);
  return {
    actor: ctx.actor,
    items: (
      await pool.query(
        "SELECT * FROM memberships WHERE tenant_id=$1 ORDER BY user_subject,id",
        [ctx.tenantId],
      )
    ).rows.map(present),
  };
}
export async function updateMember(
  ctx: Context,
  id: string,
  input: {
    role: Context["role"];
    status: "ACTIVE" | "SUSPENDED";
    expectedVersion: number;
  },
) {
  if (
    !input ||
    !roles.includes(input.role) ||
    !["ACTIVE", "SUSPENDED"].includes(input.status) ||
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 1 ||
    Object.keys(input).some(
      (k) => !["role", "status", "expectedVersion"].includes(k),
    )
  )
    throw new ApiError("INVALID_REQUEST");
  return transaction(async (db) => {
    // Serialize every membership change for this tenant, including concurrent admin demotions.
    await db.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
      ctx.tenantId,
    ]);
    await requireAdmin(ctx, db);
    const previous = (
      await db.query("SELECT * FROM memberships WHERE tenant_id=$1 AND id=$2", [
        ctx.tenantId,
        id,
      ])
    ).rows[0];
    if (!previous) throw new ApiError("RESOURCE_NOT_FOUND", 404);
    if (previous.version !== input.expectedVersion)
      throw new ApiError("REVISION_CONFLICT", 409);
    if (previous.role === input.role && previous.status === input.status)
      return present(previous);
    if (
      previous.role === "ADMIN" &&
      previous.status === "ACTIVE" &&
      (input.role !== "ADMIN" || input.status !== "ACTIVE")
    ) {
      const { rows } = await db.query(
        "SELECT count(*)::int AS count FROM memberships WHERE tenant_id=$1 AND role='ADMIN' AND status='ACTIVE'",
        [ctx.tenantId],
      );
      if (rows[0].count <= 1) throw new ApiError("LAST_ADMIN_REQUIRED", 409);
    }
    const changed = (
      await db.query(
        "UPDATE memberships SET role=$3,status=$4,version=version+1,updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING *",
        [ctx.tenantId, id, input.role, input.status],
      )
    ).rows[0];
    await db.query(
      "INSERT INTO audit_events(id,tenant_id,actor_subject,action,resource_type,resource_id,request_id,metadata_json) VALUES($1,$2,$3,'MEMBERSHIP_UPDATE','membership',$4,$5,$6)",
      [
        randomUUID(),
        ctx.tenantId,
        ctx.actor,
        id,
        ctx.requestId,
        {
          previousRole: previous.role,
          previousStatus: previous.status,
          role: input.role,
          status: input.status,
          version: changed.version,
        },
      ],
    );
    return present(changed);
  });
}
