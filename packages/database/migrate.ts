import { readFile, readdir } from "node:fs/promises";
import { pool, transaction } from "./index";
await pool.query(
  "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
);
for (const name of (await readdir("packages/database/migrations"))
  .filter((x) => x.endsWith(".sql"))
  .sort())
  await transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(847120)");
    if (
      (await db.query("SELECT 1 FROM schema_migrations WHERE name=$1", [name]))
        .rowCount
    )
      return;
    await db.query(
      await readFile(`packages/database/migrations/${name}`, "utf8"),
    );
    await db.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
    console.log(`Applied ${name}`);
  });
await pool.end();
