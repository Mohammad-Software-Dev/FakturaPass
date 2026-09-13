import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: "fakturapass-theme",
      value: "dark",
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3010",
    },
    {
      name: "fakturapass-language",
      value: "en",
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3010",
    },
  ]);
});
const base = JSON.parse(readFileSync("fixtures/valid/FP-A-001.json", "utf8"));
test("import, validate, approve, generate, evidence and correction", async ({
  page,
}) => {
  const input = structuredClone(base);
  input.source.recordId = `browser-${Date.now()}`;
  input.document.number = `BROWSER-${Date.now()}`;
  await page.goto("/");
  await page
    .getByRole("button", { name: "Import invoice", exact: true })
    .click();
  await page
    .getByLabel("Canonical JSON", { exact: true })
    .fill(JSON.stringify(input, null, 2));
  await page.getByRole("button", { name: "Check preview" }).click();
  await expect(
    page.getByRole("heading", { name: input.document.number }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Import invoice", exact: true })
    .click();
  await page.getByRole("button", { name: "Validate", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Approve revision" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Approve revision" }).click();
  await page.getByRole("button", { name: "Generate XRechnung" }).click();
  await expect(page.getByRole("link", { name: "Download XML" })).toBeVisible();
  const href = await page
    .getByRole("link", { name: "Download XML" })
    .getAttribute("href");
  const xml = await page.request.get(href!);
  expect(xml.status()).toBe(200);
  expect(await xml.text()).toContain("CustomizationID");
  await page.getByRole("tab", { name: "Artifacts & evidence" }).click();
  const evidence = await page
    .getByRole("link", { name: "Evidence", exact: true })
    .getAttribute("href");
  expect(
    (await (await page.request.get(evidence!)).json()).validation.status,
  ).toBe("PASS");
  await page.getByRole("button", { name: "Corrected revision" }).click();
  input.document.buyerReference = "CHANGED";
  await page
    .getByLabel("Canonical JSON", { exact: true })
    .fill(JSON.stringify(input));
  await page.getByRole("button", { name: "Check preview" }).click();
  await page.getByRole("button", { name: "Save new revision" }).click();
  await page.getByRole("tab", { name: "History", exact: true }).click();
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
    .getByRole("button", { name: "Import invoice", exact: true })
    .click();
  await page
    .getByLabel("Canonical JSON", { exact: true })
    .fill(JSON.stringify(input));
  await page.getByRole("button", { name: "Check preview" }).click();
  await page
    .getByRole("button", { name: "Import invoice", exact: true })
    .click();
  await page.getByRole("button", { name: "Validate", exact: true }).click();
  await expect(
    page.locator(".workflow-bar").getByText("Errors found"),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Validation results/ }).click();
  await expect(page.getByText("Invoice amounts do not match")).toBeVisible();
  await expect(page.getByText("237.99", { exact: true })).toBeVisible();
  await expect(page.getByText("238.00", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve revision" }),
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
    .getByRole("button", { name: "Import invoice", exact: true })
    .click();
  await page
    .getByLabel("Canonical JSON", { exact: true })
    .fill(JSON.stringify(input));
  await page.getByRole("button", { name: "Check preview" }).click();
  await expect(page.locator(".error-banner")).toContainText(
    "seller.electronicAddress",
  );
});
