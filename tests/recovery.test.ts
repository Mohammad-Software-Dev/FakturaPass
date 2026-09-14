import { test } from "node:test";
import assert from "node:assert/strict";
import { appendFile, readFile, writeFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import { backup, restore, localDatabase } from "../packages/operations/backup";

test("recovery tools reject remote and ambiguous database targets", () => {
  for (const value of [
    "postgres://fakturapass:secret@remote:5440/db",
    "postgres://fakturapass:local-synthetic-only@localhost:5440/db?host=remote",
    "postgres://fakturapass:local-synthetic-only@localhost:5440/invalid-name",
  ])
    assert.throws(() => localDatabase(value), /LOCAL_DATABASE_REQUIRED/);
});
test("snapshot restores all records, rejects corruption and never overwrites the source", async () => {
  const url = localDatabase();
  assert.match(
    url.pathname,
    /^\/fakturapass_verify_\d+$/,
    "Run this test through npm run verify's disposable database",
  );
  const db = new pg.Client({ connectionString: url.toString() });
  let directory: string | undefined;
  await db.connect();
  const recoveryNames = async () =>
    (
      await db.query(
        "SELECT datname FROM pg_database WHERE datname LIKE 'fakturapass_recovery_%' ORDER BY datname",
      )
    ).rows;
  const before = await recoveryNames();
  try {
    directory = await backup();
    assert.equal((await stat(directory)).mode & 0o777, 0o700);
    assert.equal(
      (await stat(join(directory, "database.dump"))).mode & 0o777,
      0o600,
    );
    const result = await restore(directory);
    assert.equal(result.retained, false);
    assert.ok(result.rows > 0);
    assert.ok(result.tables >= 18);
    assert.deepEqual(await recoveryNames(), before);
    const retained = await restore(directory, true);
    assert.equal(retained.retained, true);
    assert.match(retained.database, /^fakturapass_recovery_[a-f0-9]{32}$/);
    const recoveredUrl = new URL(url);
    recoveredUrl.pathname = `/${retained.database}`;
    const recovered = new pg.Client({
      connectionString: recoveredUrl.toString(),
    });
    try {
      await recovered.connect();
      await assert.rejects(
        recovered.query("UPDATE source_artifacts SET sha256=sha256"),
        /Immutable artifact/,
      );
    } finally {
      await recovered.end();
      await db.query(`DROP DATABASE "${retained.database}"`);
    }
    assert.deepEqual(await recoveryNames(), before);
    const path = join(directory, "manifest.json");
    const original = await readFile(path, "utf8");
    const manifest = JSON.parse(original);
    assert.ok(
      manifest.tables.generation_artifacts.rows > 0,
      "Exercise generated XML and evidence from browser acceptance",
    );
    manifest.tables.invoice_revisions.sha256 = "0".repeat(64);
    await writeFile(path, JSON.stringify(manifest));
    await assert.rejects(restore(directory), /RESTORE_VERIFICATION_FAILED/);
    assert.deepEqual(await recoveryNames(), before);
    await writeFile(path, original);
    await appendFile(join(directory, "database.dump"), "corruption");
    await assert.rejects(restore(directory), /BACKUP_INTEGRITY_FAILED/);
    assert.deepEqual(await recoveryNames(), before);
    assert.ok(
      (await db.query("SELECT count(*)::int AS n FROM invoice_revisions"))
        .rows[0].n > 0,
    );
  } finally {
    await db.end();
    if (directory) await rm(directory, { recursive: true, force: true });
  }
});
