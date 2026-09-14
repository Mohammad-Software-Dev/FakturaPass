import { readFileSync } from "node:fs";
import { pool } from "../packages/database";
import { dryRun, type CsvRecipe } from "../packages/mappings/csv";
import { sha256, stable } from "../packages/domain";
const [tenant, recipePath, samplePath] = process.argv.slice(2);
try {
  if (!tenant || !recipePath || !samplePath)
    throw Error(
      "Usage: npm run mapping:register -- TENANT RECIPE.json SAMPLE.csv",
    );
  const recipe = JSON.parse(readFileSync(recipePath, "utf8")) as CsvRecipe;
  if (
    !/^[a-zA-Z0-9_-]{1,80}$/.test(recipe.id) ||
    !/^\d{1,8}$/.test(recipe.version) ||
    !recipe.name ||
    ![";", ","].includes(recipe.delimiter)
  )
    throw Error("Invalid recipe metadata");
  const result = dryRun(readFileSync(samplePath, "utf8"), recipe);
  if (result.items.some((i) => !i.valid))
    throw Error(
      "Recipe sample must pass schema and monetary checks before registration",
    );
  await pool.query(
    "INSERT INTO csv_recipe_versions(tenant_id,id,version,recipe,sha256) VALUES($1,$2,$3,$4,$5)",
    [tenant, recipe.id, recipe.version, recipe, sha256(stable(recipe))],
  );
  console.log(
    `Registered ${recipe.id}/${recipe.version} after ${result.items.length} sample invoices passed. Official validation and customer approval remain separate.`,
  );
} finally {
  await pool.end();
}
