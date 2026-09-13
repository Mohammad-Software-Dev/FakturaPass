import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const input = readFileSync("fixtures/valid/FP-A-001.json", "utf8");
test("language switch preserves drafts, updates metadata and survives reload", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Rechnung importieren", exact: true })
    .click();
  await page.locator("#canonical").fill(input);
  await page.getByLabel("Sprache", { exact: true }).selectOption("en");
  await expect(page.locator("#canonical")).toHaveValue(input);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle("FakturaPass · Validate invoices");
  await expect(
    page.getByRole("button", { name: "Check preview" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Check preview" }).click();
  await expect(page.locator(".preview-amount")).toHaveText("€238.00");
  await expect(page.getByText("15/01/2026", { exact: true })).toBeVisible();
  await page.getByLabel("Language", { exact: true }).selectOption("de");
  await expect(page.locator(".preview-amount")).toContainText("238,00");
  await expect(page.locator("#canonical")).toHaveValue(input);
  await page.getByLabel("Sprache", { exact: true }).selectOption("en");
  await page.reload();
  await expect(page.getByLabel("Language", { exact: true })).toHaveValue("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const response = await page.request.get("/");
  expect(await response.text()).toMatch(/<html[^>]*lang="en"/);
  await page
    .getByRole("button", { name: "Settings & information", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Supported scope" }),
  ).toBeVisible();
  await page.getByText("Technical information", { exact: true }).click();
  await expect(page.getByText("Durable PostgreSQL job queue")).toBeVisible();
  await expect(page.getByText("German domestic invoices in EUR")).toBeVisible();
});
test("schema and syntax errors retranslate in place and switch remains accessible on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Rechnung importieren", exact: true })
    .click();
  await page.locator("#canonical").fill("{");
  await page.getByRole("button", { name: "Vorschau prüfen" }).click();
  await expect(page.locator(".error-banner")).toContainText("Ungültiges JSON");
  await page.getByLabel("Sprache", { exact: true }).selectOption("en");
  await expect(page.locator(".error-banner")).toContainText(
    "Invalid JSON. Please check the syntax.",
  );
  await page.locator("#canonical").fill("{}");
  await page.getByRole("button", { name: "Check preview" }).click();
  await expect(page.locator(".error-banner")).toContainText(
    "A required field is missing.",
  );
  await page.getByLabel("Language", { exact: true }).selectOption("de");
  await expect(page.locator(".error-banner")).toContainText(
    "Erforderliches Feld fehlt.",
  );
  await expect(
    page.getByRole("button", { name: "Fehlermeldung schließen" }),
  ).toBeVisible();
  expect(
    await page.locator("body").evaluate((el) => el.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("missing pages honor and retain the selected language", async ({
  page,
}) => {
  await page.goto("/missing-page");
  await expect(
    page.getByRole("heading", { name: "Seite nicht gefunden" }),
  ).toBeVisible();
  await page.getByLabel("Sprache", { exact: true }).selectOption("en");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to workspace" }).click();
  await expect(page.getByLabel("Language", { exact: true })).toHaveValue("en");
  await expect(
    page.getByRole("button", { name: "Import invoice", exact: true }),
  ).toBeVisible();
});
test("unexpected rendering errors are localized and recoverable", async ({
  page,
}) => {
  const endpoint = "**/api/v1/invoices?*";
  await page.route(endpoint, (route) =>
    route.fulfill({
      json: {
        items: [
          {
            invoiceId: "test-render-error",
            documentNumber: "test",
            buyerName: "Synthetic",
            sourceRecordId: "test",
            status: "NORMALIZED",
            issueDate: "invalid",
            payableAmount: "1.00",
            updatedAt: "invalid",
            revisionNumber: 1,
            recipientCoverage: "UNKNOWN",
            validationResult: null,
          },
        ],
        nextCursor: null,
      },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Die Ansicht konnte nicht geladen werden.",
    }),
  ).toBeVisible();
  await page.getByLabel("Sprache", { exact: true }).selectOption("en");
  await expect(
    page.getByRole("heading", { name: "The view could not be loaded." }),
  ).toBeVisible();
  await page.unroute(endpoint);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("button", { name: "Import invoice", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".error-banner")).toHaveCount(0);
});
