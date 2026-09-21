import { randomUUID } from "node:crypto";
import { transaction } from "../database";
import { principalActor } from "./oidc";
export async function bootstrapOrganization(
  id: string,
  name: string,
  issuer: string,
  subject: string,
) {
  const url = new URL(issuer);
  if (
    !/^[a-z0-9][a-z0-9-]{0,79}$/.test(id) ||
    !name?.trim() ||
    name.trim().length > 120 ||
    !subject ||
    subject.length > 255 ||
    issuer !== url.href ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw Error("INVALID_ORGANIZATION_SETUP");
  const actor = principalActor(issuer, subject);
  await transaction(async (db) => {
    await db.query("INSERT INTO tenants(id,name) VALUES($1,$2)", [
      id,
      name.trim(),
    ]);
    await db.query(
      "INSERT INTO memberships(id,tenant_id,user_subject,role,status) VALUES($1,$2,$3,'ADMIN','ACTIVE')",
      [randomUUID(), id, actor],
    );
    await db.query(
      "INSERT INTO audit_events(id,tenant_id,actor_subject,action,resource_type,resource_id,request_id,metadata_json) VALUES($1,$2,'provisioning-cli','ORGANIZATION_CREATE','tenant',$2,$3,$4)",
      [randomUUID(), id, randomUUID(), { administrator: actor }],
    );
  });
  return { tenantId: id, actor };
}
