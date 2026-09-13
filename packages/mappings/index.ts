export type SafeTransform =
  | { kind: "trim" | "normalizeWhitespace"; version: "1" }
  | { kind: "literal"; version: "1"; value: string }
  | { kind: "concatenate"; version: "1"; separator: string };
export type MappingRecipe = {
  id: string;
  version: string;
  inputFormat: "JSON" | "CSV";
  sourceSchemaFingerprint: string;
  fields: {
    targetPath: string;
    sourcePath: string;
    transform: SafeTransform;
  }[];
};
export type Provenance = {
  sourcePath: string;
  transformId: string;
  version: string;
};
export function applyTransform(
  values: string[],
  transform: SafeTransform,
): string {
  switch (transform.kind) {
    case "trim":
      return values[0].trim();
    case "normalizeWhitespace":
      return values[0].replace(/\s+/g, " ").trim();
    case "literal":
      return transform.value;
    case "concatenate":
      return values.join(transform.separator);
    default:
      throw Error("MAPPING_TRANSFORM_FORBIDDEN");
  }
}
