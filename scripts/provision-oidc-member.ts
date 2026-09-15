import { randomUUID } from "node:crypto";
import { principalActor } from "../packages/identity/oidc";
import { roles } from "../packages/identity/memberships";
import { pool, transaction } from "../packages/database";
const [tenant, issuer, subject, role, ...rest] = process.argv.slice(2);
try {
  if (
    !tenant ||
    !issuer ||
    !subject ||
    subject.length > 255 ||
    !roles.includes(role as any) ||
    rest.length
  )
    throw Error();
  const url = new URL(issuer);
  if (
    url.href !== issuer ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw Error();
  const actor = principalActor(issuer, subject);
  await transaction(async (db) => {
    await db.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [tenant]);
    const id = randomUUID();
    await db.query(
      "INSERT INTO memberships(id,tenant_id,user_subject,role,status) VALUES($1,$2,$3,$4,'ACTIVE')",
      [id, tenant, actor, role],
    );
    await db.query(
      "INSERT INTO audit_events(id,tenant_id,actor_subject,action,resource_type,resource_id,request_id,metadata_json) VALUES($1,$2,'provisioning-cli','MEMBERSHIP_PROVISION','membership',$3,$4,$5)",
      [randomUUID(), tenant, id, randomUUID(), { role }],
    );
  });
  console.log(`Provisioned membership for ${actor}`);
} catch {
  console.error(
    "Provisioning failed. Supply TENANT, exact verified HTTPS ISSUER, verified SUBJECT and ROLE. Existing memberships are never overwritten.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
