import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import {
  dictionaries,
  locales,
  translate,
  resolveLocale,
  negotiateLocale,
  money,
  decimal,
  date,
  findingDescription,
  findingTitles,
} from "../packages/i18n";
import { semanticFindings, schemaFindings } from "../packages/domain";
import type { Finding } from "../packages/contracts/types";
test("every supported locale has complete nonempty messages and matching placeholders", () => {
  const keys = Object.keys(dictionaries.de).sort();
  for (const locale of Object.keys(locales) as Array<keyof typeof locales>) {
    assert.deepEqual(Object.keys(dictionaries[locale]).sort(), keys);
    for (const key of keys) {
      const translated = translate(locale, key);
      assert(translated.trim(), key);
      assert.deepEqual(
        translated.match(/\{\w+\}/g)?.sort(),
        key.match(/\{\w+\}/g)?.sort(),
        key,
      );
    }
  }
  assert.equal(
    translate("en", "Rechnung {number} öffnen", { number: "INV-42" }),
    "Open invoice INV-42",
  );
  assert.equal(translate("en", "{count} Rechnung", { count: 1 }), "1 invoice");
  assert.equal(
    translate("en", "{count} Rechnungen", { count: 2 }),
    "2 invoices",
  );
});
test("locale selection validates preferences and respects regional tags and quality", () => {
  assert.equal(resolveLocale("en"), "en");
  assert.equal(resolveLocale("fr"), "de");
  assert.equal(resolveLocale("__proto__"), "de");
  assert.equal(negotiateLocale("fr, en-US;q=0.9, de;q=0.1"), "en");
  assert.equal(negotiateLocale("en;q=0, de-DE;q=1"), "de");
  assert.equal(negotiateLocale("en;q=invalid"), "de");
  assert.equal(negotiateLocale(null), "de");
});
test("localized decimal and currency formatting preserves precision and calendar dates", () => {
  assert.equal(money("en", "1234.50"), "€1,234.50");
  assert.equal(money("de", "1234.50"), "1.234,50\u00a0€");
  assert.equal(money("en", "-12.01"), "-€12.01");
  assert.equal(money("de", "-12.01"), "-12,01\u00a0€");
  assert.equal(
    decimal("de", "9007199254740993.1234567890123456789"),
    "9.007.199.254.740.993,1234567890123456789",
  );
  assert.equal(decimal("en", "1.2500"), "1.2500");
  assert.equal(date("de", "2026-01-15"), "15.01.2026");
  assert.equal(date("en", "2026-01-15"), "15/01/2026");
});
test("schema and domain findings have localized descriptions without mutating evidence", () => {
  const invoice = JSON.parse(
    readFileSync("fixtures/valid/FP-A-001.json", "utf8"),
  );
  delete invoice.seller.electronicAddress;
  const schema = schemaFindings(invoice)[0];
  assert.equal(
    findingDescription("en", schema),
    "A required field is missing.",
  );
  assert.equal(findingDescription("de", schema), "Erforderliches Feld fehlt.");
  const unsupported = JSON.parse(
    readFileSync("fixtures/invalid/FP-A-105.json", "utf8"),
  );
  const findings = semanticFindings(unsupported);
  for (const f of findings) {
    assert(findingTitles[f.code], f.code);
    assert(!/[äöüß]/i.test(findingDescription("en", f)));
  }
  const official: Finding = {
    ...schema,
    layer: "STANDARD",
    code: "VALIDATION_FAILED",
    ruleId: "BR-DE-6",
    parameters: { message: "Originaler offizieller Text" },
  };
  const before = JSON.stringify(official);
  assert.equal(
    findingDescription("en", official),
    "The supplier contact telephone number is required.",
  );
  assert.equal(JSON.stringify(official), before);
  official.ruleId = "FUTURE-RULE";
  assert.match(findingDescription("en", official), /original diagnostic/);
});
test("workspace UI copy is catalog-backed including accessible attributes", () => {
  const technical = new Set([
    "Faktura",
    "Pass",
    "D",
    "DO",
    "XRechnung",
    "EUR",
    "fakturapass.invoice.v1",
    "XRechnung 3.0.2",
    "KoSIT Validator 1.6.3",
    "XRechnung UBL",
    "XRechnung 3.0.2 · fakturapass-ubl/1.0.0",
    "XML",
    "FakturaPass",
  ]);
  const source = ts.createSourceFile(
    "workspace.tsx",
    readFileSync("apps/web/app/workspace.tsx", "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  function walk(node: ts.Node) {
    if (ts.isJsxText(node)) {
      const text = node.text.replace(/\s+/g, " ").trim();
      if (/[a-zA-Zäöüß]/.test(text))
        assert(technical.has(text), `Untranslated JSX: ${text}`);
    }
    if (
      ts.isJsxAttribute(node) &&
      ["aria-label", "title", "alt", "placeholder"].includes(
        node.name.getText(source),
      ) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    )
      assert.fail(`Untranslated attribute: ${node.initializer.text}`);
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(source) === "t" &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    )
      assert(
        Object.hasOwn(dictionaries.de, node.arguments[0].text),
        `Missing key: ${node.arguments[0].text}`,
      );
    ts.forEachChild(node, walk);
  }
  walk(source);
});

test("invoice review and editor labels are translated in both catalogs", () => {
  for (const file of [
    "invoice-editor.tsx",
    "invoice-review.tsx",
    "csv-import.tsx",
  ]) {
    const source = ts.createSourceFile(
      file,
      readFileSync(`apps/web/app/${file}`, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    function walk(node: ts.Node) {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(source) === "t" &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      )
        assert(
          Object.hasOwn(dictionaries.en, node.arguments[0].text),
          node.arguments[0].text,
        );
      if (
        ts.isVariableDeclaration(node) &&
        node.name.getText(source) === "editorLabels" &&
        node.initializer &&
        ts.isObjectLiteralExpression(node.initializer)
      )
        for (const property of node.initializer.properties)
          if (
            ts.isPropertyAssignment(property) &&
            ts.isStringLiteral(property.initializer)
          )
            assert(
              Object.hasOwn(dictionaries.en, property.initializer.text),
              property.initializer.text,
            );
      ts.forEachChild(node, walk);
    }
    walk(source);
  }
});
