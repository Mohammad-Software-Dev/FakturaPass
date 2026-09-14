import { sha256, stable, schemaFindings, semanticFindings } from "../domain";
import type { Invoice, Finding } from "../contracts/types";
export type CsvRecipe = {
  id: string;
  version: string;
  name: string;
  delimiter: "," | ";";
  groupColumn: string;
  sourceSchemaFingerprint: string;
  fields: { column: string; target: string; decimalSeparator?: "." | "," }[];
  constants: Record<string, unknown>;
};
export class CsvError extends Error {
  constructor(
    public reason: string,
    public row = 1,
    public column = "",
  ) {
    super(reason);
  }
}
export function parseCsv(text: string, delimiter: string): string[][] {
  if (Buffer.byteLength(text) > 512 * 1024) throw new CsvError("CSV_TOO_LARGE");
  if (text.includes("\0")) throw new CsvError("CSV_INVALID");
  text = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const endCell = () => {
    row.push(cell);
    cell = "";
    closed = false;
  };
  for (let n = 0; n < text.length; n++) {
    const c = text[n];
    if (quoted) {
      if (c === '"') {
        if (text[n + 1] === '"') {
          cell += '"';
          n++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
      continue;
    }
    if (c === '"') {
      if (cell || closed) throw new CsvError("CSV_INVALID", rows.length + 1);
      quoted = true;
    } else if (c === delimiter) endCell();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[n + 1] === "\n") n++;
      endCell();
      rows.push(row);
      row = [];
      if (rows.length > 1001) throw new CsvError("CSV_TOO_MANY_ROWS");
    } else {
      if (closed) throw new CsvError("CSV_INVALID", rows.length + 1);
      cell += c;
    }
  }
  if (quoted) throw new CsvError("CSV_INVALID", rows.length + 1);
  if (cell || closed || row.length) {
    endCell();
    rows.push(row);
  }
  if (rows.length < 2 || rows.length > 1001) throw new CsvError("CSV_INVALID");
  const headers = rows[0];
  if (
    headers.some((h) => !h) ||
    new Set(headers).size !== headers.length ||
    headers.length > 150
  )
    throw new CsvError("CSV_HEADERS");
  for (let i = 1; i < rows.length; i++)
    if (rows[i].length !== headers.length)
      throw new CsvError("CSV_COLUMNS", i + 1);
  return rows;
}
export const fingerprint = (headers: string[]) => sha256(stable(headers));
function setPath(target: any, path: string, value: unknown) {
  const parts = path.split(".");
  if (
    parts.some(
      (p) =>
        !/^([A-Za-z][A-Za-z0-9]*|0)$/.test(p) ||
        ["__proto__", "prototype", "constructor"].includes(p),
    )
  )
    throw new CsvError("MAPPING_INVALID");
  let node = target;
  for (let n = 0; n < parts.length - 1; n++)
    node = node[parts[n]] ??= parts[n + 1] === "0" ? [] : {};
  node[parts.at(-1)!] = value;
}
export function dryRun(csv: string, recipe: CsvRecipe) {
  if (![",", ";"].includes(recipe.delimiter))
    throw new CsvError("MAPPING_INVALID");
  const targets = [
    ...Object.keys(recipe.constants),
    ...recipe.fields.map((f) => f.target),
  ];
  for (let i = 0; i < targets.length; i++) {
    setPath({}, targets[i].replace("lines[]", "lines.0"), null);
    if (
      targets[i] === "lines" ||
      targets.some(
        (other, n) =>
          n !== i &&
          (other === targets[i] || other.startsWith(targets[i] + ".")),
      )
    )
      throw new CsvError("MAPPING_INVALID");
  }
  const [headers, ...rows] = parseCsv(csv, recipe.delimiter);
  if (fingerprint(headers) !== recipe.sourceSchemaFingerprint)
    throw new CsvError("CSV_SCHEMA_CHANGED");
  if (
    !headers.includes(recipe.groupColumn) ||
    recipe.fields.some((f) => !headers.includes(f.column))
  )
    throw new CsvError("CSV_HEADERS");
  const groups = new Map<
    string,
    {
      canonical: any;
      rows: number[];
      provenance: Record<
        string,
        { row: number; column: string; transform: string }
      >;
      findings: Finding[];
    }
  >();
  for (const [index, cells] of rows.entries()) {
    const row = index + 2,
      record = Object.fromEntries(headers.map((h, n) => [h, cells[n]]));
    const key = record[recipe.groupColumn];
    if (!key) throw new CsvError("CSV_GROUP_REQUIRED", row, recipe.groupColumn);
    let group = groups.get(key);
    if (!group) {
      const canonical: any = {};
      for (const [p, v] of Object.entries(recipe.constants))
        setPath(canonical, p, structuredClone(v));
      canonical.lines = [];
      group = { canonical, rows: [], provenance: {}, findings: [] };
      for (const p of Object.keys(recipe.constants))
        group.provenance[p] = { row: 0, column: p, transform: "literal/1" };
      groups.set(key, group);
      if (groups.size > 100) throw new CsvError("CSV_TOO_MANY_INVOICES");
    }
    group.rows.push(row);
    const line: any = { allowancesCharges: [] };
    const lineIndex = group.canonical.lines.length;
    for (const f of recipe.fields) {
      let value = record[f.column];
      const lineField = f.target.startsWith("lines[].");
      const path = lineField
        ? f.target.replace("lines[]", `lines.${lineIndex}`)
        : f.target;
      if (f.decimalSeparator) {
        const pattern =
          f.decimalSeparator === "," ? /^-?\d+(,\d+)?$/ : /^-?\d+(\.\d+)?$/;
        if (!pattern.test(value)) {
          group.findings.push(csvFinding("CSV_DECIMAL", path, row, f.column));
          continue;
        }
        value = value.replace(",", ".");
      }
      if (!lineField && group.provenance[path]) {
        const previous = path
          .split(".")
          .reduce((o: any, k) => o?.[k], group.canonical);
        if (previous !== value)
          group.findings.push(csvFinding("CSV_CONFLICT", path, row, f.column));
      } else {
        setPath(
          lineField ? line : group.canonical,
          lineField ? f.target.slice(8) : f.target,
          value,
        );
        group.provenance[path] = {
          row,
          column: f.column,
          transform: f.decimalSeparator
            ? `decimal-${f.decimalSeparator}/1`
            : "identity/1",
        };
      }
    }
    group.canonical.lines.push(line);
  }
  return {
    sourceSha256: sha256(csv),
    recipeId: recipe.id,
    recipeVersion: recipe.version,
    recipeSha256: sha256(stable(recipe)),
    items: [...groups].map(([sourceId, g]) => {
      const schema = schemaFindings(g.canonical);
      const findings = [
        ...g.findings,
        ...schema,
        ...(!schema.length
          ? semanticFindings(g.canonical).filter((f) => f.severity === "ERROR")
          : []),
      ].map((f) => ({
        ...f,
        sourcePath:
          !f.code.startsWith("CSV_") && g.provenance[f.canonicalPath]
            ? `row ${g.provenance[f.canonicalPath].row}, column ${g.provenance[f.canonicalPath].column}`
            : f.sourcePath,
      }));
      return {
        sourceId,
        rows: g.rows,
        canonical: g.canonical as Invoice,
        provenance: g.provenance,
        findings,
        valid: findings.every((f) => f.severity !== "ERROR"),
      };
    }),
  };
}
function csvFinding(
  code: string,
  path: string,
  row: number,
  column: string,
): Finding {
  return {
    code,
    severity: "ERROR",
    layer: "SCHEMA",
    canonicalPath: path,
    sourcePath: `row ${row}, column ${column}`,
    ruleId: null,
    messageKey: code,
    parameters: { row, column },
    evidenceSource: null,
  };
}
