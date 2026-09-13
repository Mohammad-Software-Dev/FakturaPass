import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "./schemas/invoice-v1.schema.json";
import type { Finding } from "./types";
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);
export function schemaFindings(input: unknown): Finding[] {
  if (validate(input)) return [];
  return (validate.errors ?? []).map((e) => {
    const path = `${e.instancePath.replace(/^\//, "").replaceAll("/", ".")}${e.keyword === "required" ? `${e.instancePath ? "." : ""}${e.params.missingProperty}` : ""}`;
    return {
      code: "SCHEMA_INVALID",
      severity: "ERROR",
      layer: "SCHEMA",
      canonicalPath: path,
      sourcePath: path ? `$.${path}` : null,
      ruleId: null,
      messageKey: "SCHEMA_INVALID",
      parameters: { message: e.message, keyword: e.keyword },
      evidenceSource: null,
    };
  });
}
