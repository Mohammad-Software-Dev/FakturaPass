import { randomBytes, randomUUID } from "node:crypto";
import { pool, transaction, type DB } from "../database";
import { sha256 } from "../domain";
import { ApiError, type Context } from "../domain/service";
import { resolveMembership } from "./memberships";
import { settings } from "./oidc";
import { credentialScopes, requiredCredentialScope } from "./credential-scopes";
const secret = () => `fp_${randomBytes(32).toString("base64url")}`;
async function admin(ctx: Context, db: DB) {
  if ((await resolveMembership(ctx.tenantId, ctx.actor, db)) !== "ADMIN")
    throw new ApiError("ACCESS_DENIED", 403);
}
async function audit(
  db: DB,
  ctx: Context,
  id: string,
  action: string,
  metadata: object = {},
) {
  await db.query(
    "INSERT INTO audit_events(id,tenant_id,actor_subject,action,resource_type,resource_id,request_id,metadata_json) VALUES($1,$2,$3,$4,'api_credential',$5,$6,$7)",
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
function present(row: any) {
  return {
    id: row.id,
    name: row.name,
    owner: row.owner_subject,
    environment: row.environment,
    scopes: row.scopes,
    version: row.version,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    lastUsedAt: row.last_used_at?.toISOString() ?? null,
    status: row.revoked_at
      ? "REVOKED"
      : row.expires_at <= new Date()
        ? "EXPIRED"
        : row.authority_sha256 !== settings().authority ||
            row.owner_status !== "ACTIVE"
          ? "UNAVAILABLE"
          : "ACTIVE",
  };
}
export async function listCredentials(ctx: Context) {
  await admin(ctx, pool);
  return {
    items: (
      await pool.query(
        "SELECT c.*,m.status AS owner_status FROM api_credentials c JOIN memberships m ON m.tenant_id=c.tenant_id AND m.user_subject=c.owner_subject WHERE c.tenant_id=$1 ORDER BY c.created_at DESC,c.id",
        [ctx.tenantId],
      )
    ).rows.map(present),
  };
}
export async function createCredential(ctx: Context, input: any) {
  if (
    !input ||
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.trim().length > 80 ||
    !Array.isArray(input.scopes) ||
    !input.scopes.length ||
    input.scopes.length > Object.keys(credentialScopes).length ||
    input.scopes.some(
      (s: unknown) =>
        typeof s !== "string" || !Object.hasOwn(credentialScopes, s),
    ) ||
    new Set(input.scopes).size !== input.scopes.length ||
    !Number.isInteger(input.expiresInDays) ||
    input.expiresInDays < 1 ||
    input.expiresInDays > 90 ||
    Object.keys(input).some(
      (k) => !["name", "scopes", "expiresInDays"].includes(k),
    )
  )
    throw new ApiError("INVALID_REQUEST");
  const config = settings();
  return transaction(async (db) => {
    await db.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
      ctx.tenantId,
    ]);
    await admin(ctx, db);
    const token = secret(),
      id = randomUUID();
    const row = (
      await db.query(
        "INSERT INTO api_credentials(id,tenant_id,owner_subject,authority_sha256,environment,name,scopes,token_sha256,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+$9*interval '1 day') RETURNING *, 'ACTIVE' AS owner_status",
        [
          id,
          ctx.tenantId,
          ctx.actor,
          config.authority,
          config.environment,
          input.name.trim(),
          input.scopes,
          sha256(token),
          input.expiresInDays,
        ],
      )
    ).rows[0];
    await audit(db, ctx, id, "API_CREDENTIAL_CREATE", {
      scopes: input.scopes,
      expiresAt: row.expires_at,
      environment: config.environment,
    });
    return { ...present(row), secret: token };
  });
}
export async function changeCredential(
  ctx: Context,
  id: string,
  action: "rotate" | "revoke",
  input: any,
) {
  if (
    !input ||
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 1 ||
    Object.keys(input).some((k) => k !== "expectedVersion")
  )
    throw new ApiError("INVALID_REQUEST");
  return transaction(async (db) => {
    await db.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
      ctx.tenantId,
    ]);
    await admin(ctx, db);
    const row = (
      await db.query(
        "SELECT c.*,m.status AS owner_status FROM api_credentials c JOIN memberships m ON m.tenant_id=c.tenant_id AND m.user_subject=c.owner_subject WHERE c.tenant_id=$1 AND c.id=$2 FOR UPDATE OF c",
        [ctx.tenantId, id],
      )
    ).rows[0];
    if (!row) throw new ApiError("RESOURCE_NOT_FOUND", 404);
    if (row.version !== input.expectedVersion)
      throw new ApiError("REVISION_CONFLICT", 409);
    if (
      action === "rotate" &&
      (present(row).status !== "ACTIVE" || row.owner_subject !== ctx.actor)
    )
      throw new ApiError("ACCESS_DENIED", 403);
    if (action === "revoke" && row.revoked_at) return present(row);
    const token = action === "rotate" ? secret() : undefined;
    const changed = (
      await db.query(
        action === "rotate"
          ? "UPDATE api_credentials SET token_sha256=$3,version=version+1 WHERE tenant_id=$1 AND id=$2 RETURNING *"
          : "UPDATE api_credentials SET revoked_at=now(),version=version+1 WHERE tenant_id=$1 AND id=$2 RETURNING *",
        [ctx.tenantId, id, ...(token ? [sha256(token)] : [])],
      )
    ).rows[0];
    await audit(
      db,
      ctx,
      id,
      action === "rotate" ? "API_CREDENTIAL_ROTATE" : "API_CREDENTIAL_REVOKE",
      { version: changed.version },
    );
    return {
      ...present({ ...changed, owner_status: row.owner_status }),
      ...(token ? { secret: token } : {}),
    };
  });
}
export async function credentialContext(
  req: Request,
  requestId: string,
  path: string,
): Promise<Context> {
  const token = req.headers.get("X-API-Key") ?? "";
  if (!/^fp_[A-Za-z0-9_-]{43}$/.test(token) || req.headers.has("authorization"))
    throw new ApiError("AUTH_REQUIRED", 401);
  const config = settings();
  return transaction(async (db) => {
    // Rotation/revocation serialize with authentication. Already admitted requests may finish.
    const row = (
      await db.query(
        "SELECT * FROM api_credentials WHERE token_sha256=$1 AND authority_sha256=$2 AND environment=$3 AND revoked_at IS NULL AND expires_at>now() FOR UPDATE",
        [sha256(token), config.authority, config.environment],
      )
    ).rows[0];
    if (!row) throw new ApiError("AUTH_REQUIRED", 401);
    const scope = requiredCredentialScope(req.method, path);
    const url = new URL(req.url),
      selectors = url.searchParams.getAll("workspace"),
      header = req.headers.get("X-Workspace-Id");
    if (
      !scope ||
      !row.scopes.includes(scope) ||
      selectors.length > 1 ||
      selectors.some((s) => s !== row.tenant_id) ||
      (header !== null && header !== row.tenant_id)
    )
      throw new ApiError("ACCESS_DENIED", 403);
    const ctx = {
      tenantId: row.tenant_id,
      actor: row.owner_subject,
      role: await resolveMembership(row.tenant_id, row.owner_subject, db),
      environment: row.environment,
      requestId,
    };
    await db.query(
      "UPDATE api_credentials SET last_used_at=now() WHERE id=$1",
      [row.id],
    );
    await audit(db, ctx, row.id, "API_CREDENTIAL_USE", {
      scope,
      version: row.version,
      method: req.method,
    });
    return ctx;
  });
}
