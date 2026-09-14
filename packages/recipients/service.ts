import { randomUUID } from "node:crypto";
import { pool, transaction, type DB } from "../database";
import { ApiError, authorize, type Context } from "../domain/service";
import { sha256, stable } from "../domain";
import {
  syntheticVersions,
  validateProfile,
  coverage,
  type Profile,
  type Version,
} from "./model";
function version(row: any): Version {
  const p = row.rules_json;
  if (sha256(stable(p)) !== row.sha256)
    throw new ApiError("ARTIFACT_HASH_MISMATCH", 500);
  return {
    ...p,
    required: p.requirements.map((r: any) => r.fieldPath),
    versionId: row.id,
    version: row.version,
    sha256: row.sha256,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    current: row.current_version_id === row.id,
  };
}
export async function resolve(
  ctx: Context,
  id: string | null,
  db: DB = pool,
): Promise<Version | null> {
  if (!id) return null;
  const synthetic = syntheticVersions().find((p) => p.versionId === id);
  if (synthetic) return synthetic;
  const row = (
    await db.query(
      "SELECT v.*,p.current_version_id FROM recipient_profile_versions v JOIN recipient_profiles p ON p.id=v.profile_id WHERE p.tenant_id=$1 AND v.id=$2",
      [ctx.tenantId, id],
    )
  ).rows[0];
  if (!row) throw new ApiError("RECIPIENT_PROFILE_UNKNOWN", 404);
  return version(row);
}
export async function list(ctx: Context) {
  const rows = (
    await pool.query(
      "SELECT v.*,p.current_version_id FROM recipient_profiles p JOIN recipient_profile_versions v ON v.id=p.current_version_id WHERE p.tenant_id=$1 ORDER BY p.recipient_key",
      [ctx.tenantId],
    )
  ).rows;
  return [...rows.map(version), ...syntheticVersions()].map((p) => ({
    ...p,
    coverage: coverage(p),
  }));
}
export async function history(ctx: Context, key: string) {
  const synthetic = syntheticVersions().find((p) => p.recipientKey === key);
  if (synthetic) return [synthetic];
  const rows = (
    await pool.query(
      "SELECT v.*,p.current_version_id FROM recipient_profiles p JOIN recipient_profile_versions v ON v.profile_id=p.id WHERE p.tenant_id=$1 AND p.recipient_key=$2 ORDER BY v.created_at DESC,v.id DESC",
      [ctx.tenantId, key],
    )
  ).rows;
  if (!rows.length) throw new ApiError("RECIPIENT_PROFILE_UNKNOWN", 404);
  return rows.map(version);
}
export async function publish(
  ctx: Context,
  input: { profile: Profile; priorVersionId: string | null },
) {
  authorize(ctx, ["ADMIN"]);
  try {
    validateProfile(input?.profile);
    if (
      input.priorVersionId !== null &&
      typeof input.priorVersionId !== "string"
    )
      throw Error();
  } catch {
    throw new ApiError("INVALID_REQUEST");
  }
  return transaction(async (db) => {
    const p = input.profile;
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `${ctx.tenantId}/recipient/${p.recipientKey}`,
    ]);
    let parent = (
      await db.query(
        "SELECT * FROM recipient_profiles WHERE tenant_id=$1 AND recipient_key=$2 FOR UPDATE",
        [ctx.tenantId, p.recipientKey],
      )
    ).rows[0];
    if ((parent?.current_version_id ?? null) !== input.priorVersionId)
      throw new ApiError("REVISION_CONFLICT", 409);
    if (!parent)
      parent = (
        await db.query(
          "INSERT INTO recipient_profiles(id,tenant_id,recipient_key,status) VALUES($1,$2,$3,$4) RETURNING *",
          [randomUUID(), ctx.tenantId, p.recipientKey, p.status],
        )
      ).rows[0];
    const count = Number(
      (
        await db.query(
          "SELECT count(*) FROM recipient_profile_versions WHERE profile_id=$1",
          [parent.id],
        )
      ).rows[0].count,
    );
    const id = randomUUID();
    await db.query(
      "INSERT INTO recipient_profile_versions(id,profile_id,version,rules_json,source_evidence_json,sha256,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        id,
        parent.id,
        String(count + 1),
        p,
        JSON.stringify(p.evidence),
        sha256(stable(p)),
        ctx.actor,
      ],
    );
    await db.query(
      "UPDATE recipient_profiles SET current_version_id=$1,status=$2 WHERE id=$3",
      [id, p.status, parent.id],
    );
    await db.query(
      "INSERT INTO audit_events(id,tenant_id,actor_subject,action,resource_type,resource_id,request_id,metadata_json) VALUES($1,$2,$3,$4,'recipient_profile',$5,$6,'{}')",
      [
        randomUUID(),
        ctx.tenantId,
        ctx.actor,
        "RECIPIENT_PROFILE_PUBLISH",
        id,
        ctx.requestId,
      ],
    );
    return resolve(ctx, id, db);
  });
}
export async function assertCurrent(
  ctx: Context,
  id: string | null,
  invoice: any,
  db: DB = pool,
) {
  const p = await resolve(ctx, id, db);
  if (p && p.status !== "SYNTHETIC") {
    // Serialize publication against approval/generation without changing old versions.
    await db.query(
      "SELECT id FROM recipient_profiles WHERE tenant_id=$1 AND recipient_key=$2 FOR SHARE",
      [ctx.tenantId, p.recipientKey],
    );
    const current = await resolve(ctx, id, db);
    if (!["VERIFIED", "UNVERIFIED"].includes(coverage(current, invoice)))
      throw new ApiError("APPROVAL_STALE", 409);
  }
  return p;
}
