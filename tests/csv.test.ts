import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  dryRun,
  parseCsv,
  fingerprint,
  type CsvRecipe,
} from "../packages/mappings/csv";
const recipe = JSON.parse(
  readFileSync("examples/csv-recipe.json", "utf8"),
) as CsvRecipe;
const csv = readFileSync("examples/customer-invoices.csv", "utf8");
test("CSV export groups repeated invoice fields without changing amounts or leading zero IDs", () => {
  const r = dryRun(csv, recipe);
  assert.equal(r.items.length, 2);
  assert(r.items.every((i) => i.valid));
  assert.equal(r.items[0].canonical.lines.length, 3);
  assert.equal(r.items[0].canonical.totals.payableAmount, "2045.61");
  assert.equal(r.items[0].canonical.document.number, "CSV-2026-001");
  assert.equal(r.items[0].provenance["lines.0.quantity"].row, 2);
  assert.deepEqual(r.items[1].rows, [5, 6, 7]);
});
test("CSV parser respects quotes, escaped quotes, CRLF, BOM and empty final fields", () => {
  assert.deepEqual(parseCsv('\uFEFFa;b;c\r\n"hello;there";"a""b";\r\n', ";"), [
    ["a", "b", "c"],
    ["hello;there", 'a"b', ""],
  ]);
  assert.deepEqual(parseCsv('a,b\n"two\nlines",x', ","), [
    ["a", "b"],
    ["two\nlines", "x"],
  ]);
  for (const input of [
    "a;a\n1;2",
    "a;b\n1",
    'a;b\n"unclosed;x',
    'a;b\n"a"oops;x',
    'a;b\nhi"x;y',
  ])
    assert.throws(() => parseCsv(input, ";"));
});
test("CSV conflicts and locale mistakes are attached to a row and field; schema drift fails closed", () => {
  let text = csv.replace("2045.61", "2046.61");
  const r = dryRun(text, recipe);
  assert(!r.items[0].valid);
  assert(
    r.items[0].findings.some(
      (f) => f.code === "CSV_CONFLICT" && f.sourcePath?.includes("row 3,"),
    ),
  );
  text = csv.replace("12.5", "12,5");
  assert(
    dryRun(text, recipe).items[0].findings.some(
      (f) => f.code === "CSV_DECIMAL",
    ),
  );
  assert.throws(() => dryRun(csv.replace("source.system", "changed"), recipe));
  const comma = structuredClone(recipe);
  comma.fields.find((f) => f.target === "lines[].quantity")!.decimalSeparator =
    ",";
  assert(
    dryRun(
      csv.replace("12.5", "12,5").replace("12.5", "12,5"),
      comma,
    ).items.every((i) => i.valid),
  );
});
test("mapping cannot write object prototypes and limits are enforced", () => {
  const bad = structuredClone(recipe);
  bad.constants = { "__proto__.polluted": "yes" };
  assert.throws(() => dryRun(csv, bad));
  assert.equal(({} as any).polluted, undefined);
  assert.throws(() => parseCsv("a\n" + "x".repeat(524289), ","));
  assert.throws(() => parseCsv("a\n" + "x\n".repeat(1001), ","));
  assert.notEqual(fingerprint(["a", "b"]), fingerprint(["b", "a"]));
});
