import { backup, restore } from "../packages/operations/backup";
const [action, directory, option, ...rest] = process.argv.slice(2);
try {
  if (action === "create" && !directory)
    console.log(`Backup saved: ${await backup()}`);
  else if (
    action === "restore" &&
    directory &&
    (!option || option === "--keep") &&
    !rest.length
  )
    console.log(
      JSON.stringify(await restore(directory, option === "--keep"), null, 2),
    );
  else
    throw Error(
      "USAGE: npm run backup:create | npm run backup:verify -- <directory> [--keep]",
    );
} catch (error) {
  const message = (error as Error).message;
  console.error(
    /^[A-Z_]+$/.test(message) || message.startsWith("USAGE:")
      ? message
      : "BACKUP_OPERATION_FAILED",
  );
  process.exitCode = 1;
}
