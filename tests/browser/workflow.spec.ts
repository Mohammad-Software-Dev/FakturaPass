import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const base = JSON.parse(readFileSync("fixtures/valid/FP-A-001.json", "utf8"));
test("import, validate, approve, generate, evidence and correction", async ({
  page,
}) => {
  const input = structuredClone(base);
  input.source.recordId = `browser-${Date.now()}`;
  input.document.number = `BROWSER-${Date.now()}`;
  await page.goto("/");
  await page
    .getByRole("button", { name: "Rechnung importieren", exact: true })
    .click();
  await page.locator("#canonical").fill(JSON.stringify(input, null, 2));
  await page.getByRole("button", { name: "Vorschau prüfen" }).click();
  await expect(
    page.getByRole("heading", { name: input.document.number }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Rechnung importieren", exact: true })
    .click();
  await page.getByRole("button", { name: "Prüfen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Revision freigeben" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Revision freigeben" }).click();
  await page.getByRole("button", { name: "XRechnung erstellen" }).click();
  await expect(
    page.getByRole("link", { name: "XML herunterladen" }),
  ).toBeVisible();
  const href = await page
    .getByRole("link", { name: "XML herunterladen" })
    .getAttribute("href");
  const xml = await page.request.get(href!);
  expect(xml.status()).toBe(200);
  expect(await xml.text()).toContain("CustomizationID");
  await page.getByRole("tab", { name: "Artefakte & Nachweise" }).click();
  const evidence = await page
    .getByRole("link", { name: "Nachweis", exact: true })
    .getAttribute("href");
  expect(
    (await (await page.request.get(evidence!)).json()).validation.status,
  ).toBe("PASS");
  await page.getByRole("button", { name: "Korrigierte Revision" }).click();
  input.document.buyerReference = "CHANGED";
  await page.locator(".advanced-json summary").click();
  await page.locator("#canonical").fill(JSON.stringify(input));
  await page.getByRole("button", { name: "Vorschau prüfen" }).click();
  await page.getByRole("button", { name: "Neue Revision speichern" }).click();
  await page.getByRole("tab", { name: "Verlauf", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Revision 2/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Revision 1/ })).toBeVisible();
});
test("negative totals show declared versus computed and block approval", async ({
  page,
}) => {
  const input = structuredClone(base);
  input.source.recordId = `invalid-${Date.now()}`;
  input.document.number = `ERROR-${Date.now()}`;
  input.totals.payableAmount = "237.99";
  await page.goto("/");
  await page
    .getByRole("button", { name: "Rechnung importieren", exact: true })
    .click();
  await page.locator("#canonical").fill(JSON.stringify(input));
  await page.getByRole("button", { name: "Vorschau prüfen" }).click();
  await page
    .getByRole("button", { name: "Rechnung importieren", exact: true })
    .click();
  await page.getByRole("button", { name: "Prüfen", exact: true }).click();
  await expect(
    page.locator(".workflow-bar").getByText("Fehler gefunden"),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Prüfergebnisse/ }).click();
  await expect(
    page.getByText("Rechnungsbeträge stimmen nicht überein"),
  ).toBeVisible();
  await expect(page.getByText("237,99", { exact: true })).toBeVisible();
  await expect(page.getByText("238,00", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Revision freigeben" }),
  ).toHaveCount(0);
});
test("schema errors identify a missing field and mobile layout remains usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const input = structuredClone(base);
  delete input.seller.electronicAddress;
  await page.goto("/");
  await page
    .getByRole("button", { name: "Rechnung importieren", exact: true })
    .click();
  await page.locator("#canonical").fill(JSON.stringify(input));
  await page.getByRole("button", { name: "Vorschau prüfen" }).click();
  await expect(page.locator(".error-banner")).toContainText(
    "seller.electronicAddress",
  );
});
