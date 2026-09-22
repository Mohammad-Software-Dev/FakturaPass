import { build } from "esbuild";
await build({
  entryPoints: {
    worker: "apps/worker/index.ts",
    migrate: "packages/database/migrate.ts",
    operations: "scripts/operations-check.ts",
    "identity-provision": "scripts/provision-oidc-member.ts",
    "organization-bootstrap": "scripts/bootstrap-organization.ts",
    "support-agent": "scripts/support-agent.ts",
    "mapping-register": "scripts/register-csv-recipe.ts",
  },
  outdir: ".data/runtime",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  packages: "external",
  platform: "node",
  target: "node22",
  format: "esm",
});
