import { pool } from "../packages/database";
import {
  registerSupportAgent,
  suspendSupportAgent,
} from "../packages/identity/support";
const [action, ...args] = process.argv.slice(2);
try {
  if (action === "register" && args.length === 3)
    console.log(
      JSON.stringify(await registerSupportAgent(args[0], args[1], args[2])),
    );
  else if (action === "suspend" && args.length === 1) {
    await suspendSupportAgent(args[0]);
    console.log("Support specialist suspended; grants revoked.");
  } else throw Error();
} catch {
  console.error(
    "Support setup failed. Use configured OIDC settings and: register EXACT_VERIFIED_ISSUER VERIFIED_SUBJECT DISPLAY_NAME, or suspend AGENT_ID. Registration never grants invoice access.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
