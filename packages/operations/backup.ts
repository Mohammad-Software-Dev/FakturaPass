import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pipeline } from "node:stream/promises";
import pg from "pg";

export function localDatabase(value = process.env.DATABASE_URL) {
  const url = new URL(
    value ??
      "postgres://fakturapass:local-synthetic-only@127.0.0.1:5440/fakturapass",
  );
  if (
    (process.env.FAKTURAPASS_ENV ?? "LOCAL") !== "LOCAL" ||
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "5440" ||
    url.username !== "fakturapass" ||
    url.password !== "local-synthetic-only" ||
    url.search ||
    !/^\/[a-z][a-z0-9_]{0,62}$/.test(url.pathname)
  )
    throw Error("LOCAL_DATABASE_REQUIRED");
  return url;
}
const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"';
async function digest(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
async function fingerprint(db: pg.Client) {
  const tables = (
    await db.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename COLLATE \"C\"",
    )
  ).rows;
  const result: Record<string, { rows: number; sha256: string }> = {};
  for (const { tablename } of tables) {
    const hash = createHash("sha256");
    let count = 0;
    await db.query(
      `DECLARE backup_rows NO SCROLL CURSOR FOR SELECT row_to_json(t)::text AS value FROM public.${quote(tablename)} t ORDER BY row_to_json(t)::text COLLATE "C"`,
    );
    for (;;) {
      const rows = (await db.query("FETCH 100 FROM backup_rows")).rows;
      for (const row of rows) {
        hash.update(row.value + "\n");
        count++;
      }
      if (rows.length < 100) break;
    }
    await db.query("CLOSE backup_rows");
    result[tablename] = { rows: count, sha256: hash.digest("hex") };
  }
  if (!result.schema_migrations || !result.invoice_revisions)
    throw Error("NOT_FAKTURAPASS_DATABASE");
  return result;
}
async function command(args: string[], path: string, input = false) {
  const child = spawn(
    "docker",
    ["compose", "-f", "infra/compose.yaml", "exec", "-T", "postgres", ...args],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  // PostgreSQL errors may include record contents; expose only a stable error code.
  child.stderr.resume();
  const exited = new Promise<void>((ok, fail) => {
    child.once("error", () => fail(Error("DATABASE_TOOL_FAILED")));
    child.once("exit", (code) =>
      code === 0 ? ok() : fail(Error("DATABASE_TOOL_FAILED")),
    );
  });
  let copied: Promise<void>;
  if (input) {
    child.stdout.resume();
    copied = pipeline(createReadStream(path), child.stdin);
  } else {
    child.stdin.end();
    copied = pipeline(
      child.stdout,
      createWriteStream(path, { flags: "wx", mode: 0o600 }),
    );
  }
  try {
    await Promise.all([copied, exited]);
  } catch {
    child.kill();
    throw Error("DATABASE_TOOL_FAILED");
  }
}
export async function backup(value?: string) {
  const url = localDatabase(value);
  const root = resolve(".data/backups");
  await mkdir(root, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(join(root, "snapshot-"));
  const db = new pg.Client({ connectionString: url.toString() });
  try {
    await db.connect();
    await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await db.query("SET LOCAL TIME ZONE 'UTC'");
    const snapshot = (await db.query("SELECT pg_export_snapshot() AS id"))
      .rows[0].id;
    const tables = await fingerprint(db);
    const archive = join(directory, "database.dump");
    await command(
      [
        "pg_dump",
        "-U",
        "fakturapass",
        "-d",
        url.pathname.slice(1),
        "--format=custom",
        "--no-owner",
        "--no-acl",
        `--snapshot=${snapshot}`,
      ],
      archive,
    );
    await db.query("COMMIT");
    await writeFile(
      join(directory, "manifest.json"),
      JSON.stringify(
        {
          format: 1,
          createdAt: new Date().toISOString(),
          archiveSha256: await digest(archive),
          tables,
        },
        null,
        2,
      ) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    return directory;
  } catch {
    await rm(directory, { recursive: true, force: true });
    throw Error("BACKUP_FAILED");
  } finally {
    await db.end();
  }
}
export async function restore(directory: string, keep = false, value?: string) {
  const url = localDatabase(value);
  const archive = join(resolve(directory), "database.dump");
  const manifest = JSON.parse(
    await readFile(join(resolve(directory), "manifest.json"), "utf8"),
  );
  if (
    manifest.format !== 1 ||
    !manifest.tables ||
    manifest.archiveSha256 !== (await digest(archive))
  )
    throw Error("BACKUP_INTEGRITY_FAILED");
  const name = `fakturapass_recovery_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Client({ connectionString: url.toString() });
  const targetUrl = new URL(url);
  targetUrl.pathname = `/${name}`;
  const target = new pg.Client({ connectionString: targetUrl.toString() });
  let created = false,
    verified = false;
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE ${quote(name)} TEMPLATE template0`);
    created = true;
    await command(
      [
        "pg_restore",
        "-U",
        "fakturapass",
        "-d",
        name,
        "--no-owner",
        "--no-acl",
        "--single-transaction",
        "--exit-on-error",
      ],
      archive,
      true,
    );
    await target.connect();
    await target.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await target.query("SET LOCAL TIME ZONE 'UTC'");
    const tables = await fingerprint(target);
    if (JSON.stringify(tables) !== JSON.stringify(manifest.tables))
      throw Error("RESTORE_VERIFICATION_FAILED");
    await target.query("COMMIT");
    verified = true;
    return {
      database: name,
      retained: keep,
      tables: Object.keys(tables).length,
      rows: Object.values(tables).reduce((sum, t) => sum + t.rows, 0),
    };
  } finally {
    await target.end();
    try {
      if (created && (!verified || !keep))
        await admin.query(`DROP DATABASE ${quote(name)}`);
    } finally {
      await admin.end();
    }
  }
}
