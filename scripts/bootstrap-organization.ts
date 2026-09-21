import { bootstrapOrganization } from "../packages/identity/organizations";
import { pool } from "../packages/database";
const [id, name, issuer, subject, ...rest] = process.argv.slice(2);
try {
  if (rest.length) throw Error();
  console.log(
    JSON.stringify(await bootstrapOrganization(id, name, issuer, subject)),
  );
} catch {
  console.error(
    "Organization setup failed. Supply a new TENANT_ID, NAME, exact verified HTTPS ISSUER and verified SUBJECT. Existing organizations are never overwritten.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
