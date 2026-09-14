import { pool, transaction } from "../database";
import { ApiError, authorize, ingest, type Context } from "../domain/service";
import { sha256, stable } from "../domain";
import { CsvError, dryRun, type CsvRecipe } from "./csv";
export async function recipes(ctx: Context) {
  return (
    await pool.query(
      "SELECT id,version,recipe,sha256 FROM csv_recipe_versions WHERE tenant_id=$1 ORDER BY id,version",
      [ctx.tenantId],
    )
  ).rows.map((r) => ({
    id: r.id,
    version: r.version,
    name: r.recipe.name,
    sha256: r.sha256,
    delimiter: r.recipe.delimiter,
  }));
}
async function recipe(
  ctx: Context,
  id: string,
  version: string,
): Promise<CsvRecipe> {
  const r = (
    await pool.query(
      "SELECT recipe,sha256 FROM csv_recipe_versions WHERE tenant_id=$1 AND id=$2 AND version=$3",
      [ctx.tenantId, id, version],
    )
  ).rows[0];
  if (!r) throw new ApiError("RESOURCE_NOT_FOUND", 404);
  if (sha256(stable(r.recipe)) !== r.sha256)
    throw new ApiError("ARTIFACT_HASH_MISMATCH", 500);
  return r.recipe;
}
export type CsvInput = { csv: string; recipeId: string; recipeVersion: string };
export async function preview(ctx: Context, input: CsvInput) {
  if (
    !input ||
    typeof input.csv !== "string" ||
    typeof input.recipeId !== "string" ||
    typeof input.recipeVersion !== "string"
  )
    throw new ApiError("INVALID_REQUEST");
  try {
    return dryRun(
      input.csv,
      await recipe(ctx, input.recipeId, input.recipeVersion),
    );
  } catch (e) {
    if (e instanceof CsvError)
      throw new ApiError("MAPPING_INVALID", 400, {
        reason: e.reason,
        row: e.row,
        column: e.column,
      });
    throw e;
  }
}
export async function commit(
  ctx: Context,
  input: CsvInput & { sourceSha256: string; recipeSha256: string },
  key: string,
) {
  authorize(ctx, ["ADMIN", "OPERATOR"]);
  if (!key || key.length > 200) throw new ApiError("INVALID_REQUEST");
  const result = await preview(ctx, input);
  if (
    result.sourceSha256 !== input.sourceSha256 ||
    result.recipeSha256 !== input.recipeSha256
  )
    throw new ApiError("REVISION_CONFLICT", 409);
  if (result.items.some((i) => !i.valid))
    throw new ApiError("MAPPING_INVALID", 422, { reason: "CSV_FIX_ERRORS" });
  return transaction(async (db) => {
    const routeKey = "csv/import";
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `${ctx.tenantId}/${routeKey}/${key}`,
    ]);
    const hash = sha256(stable(input));
    const prior = (
      await db.query(
        "SELECT request_sha256,response_json FROM idempotency_records WHERE tenant_id=$1 AND route_key=$2 AND idempotency_key=$3",
        [ctx.tenantId, routeKey, key],
      )
    ).rows[0];
    if (prior) {
      if (prior.request_sha256 !== hash)
        throw new ApiError("IDEMPOTENCY_CONFLICT", 409);
      return prior.response_json;
    }
    const output = [];
    for (const item of result.items) {
      const mapping = {
        recipeId: result.recipeId,
        recipeVersion: result.recipeVersion,
        recipeSha256: result.recipeSha256,
        recipe: await recipe(ctx, input.recipeId, input.recipeVersion),
        rows: item.rows,
        provenance: item.provenance,
      };
      try {
        const saved = await ingest(
          ctx,
          item.canonical,
          Buffer.from(input.csv),
          `csv-${sha256(`${key}/${item.sourceId}`)}`,
          mapping,
          db,
        );
        output.push({
          sourceId: item.sourceId,
          invoiceId: saved.invoiceId,
          status: "IMPORTED",
        });
      } catch (e) {
        if (e instanceof ApiError && e.code === "SOURCE_DUPLICATE")
          output.push({
            sourceId: item.sourceId,
            invoiceId: e.details.invoiceId,
            status: "EXISTS",
          });
        else throw e;
      }
    }
    const response = { items: output };
    await db.query(
      "INSERT INTO idempotency_records(id,tenant_id,route_key,idempotency_key,request_sha256,response_status,response_json) VALUES($1,$2,$3,$4,$5,200,$6)",
      [crypto.randomUUID(), ctx.tenantId, routeKey, key, hash, response],
    );
    return response;
  });
}
