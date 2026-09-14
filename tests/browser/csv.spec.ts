import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test("CSV batch preview, commit, open and validate with immutable provenance", async ({
  page,
}, info) => {
  await page.context().addCookies([
    {
      name: "fakturapass-language",
      value: "en",
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3010",
    },
  ]);
  await page.goto("/");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByRole("button", { name: "CSV batch", exact: true }).click();
  const csv = readFileSync("examples/customer-invoices.csv", "utf8").replaceAll(
    "CSV-EXAMPLE",
    `CSV-${info.project.name}-${Date.now()}`,
  );
  await page
    .getByRole("button", { name: "Choose CSV file", exact: true })
    .setInputFiles({
      name: "invoices.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  await page.getByRole("button", { name: "Preview CSV", exact: true }).click();
  await expect(page.locator(".csv-invoice")).toHaveCount(2);
  await page.locator(".csv-invoice summary").first().click();
  await expect(page.locator(".csv-invoice").first()).toContainText("€2,045.61");
  await page
    .getByRole("button", { name: "Import all invoices", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Import complete" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open invoice", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Validate", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Approve revision", exact: true }),
  ).toBeVisible();
});
test("CSV format mismatch explains recovery and prevents committing", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "fakturapass-language",
      value: "en",
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3010",
    },
  ]);
  await page.goto("/");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByRole("button", { name: "CSV batch", exact: true }).click();
  await page
    .getByRole("button", { name: "Choose CSV file", exact: true })
    .setInputFiles({
      name: "wrong.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("a;b\n1;2"),
    });
  await page.getByRole("button", { name: "Preview CSV", exact: true }).click();
  await expect(page.locator(".csv-import").getByRole("alert")).toContainText(
    "columns have changed",
  );
  await expect(
    page.getByRole("button", { name: "Import all invoices", exact: true }),
  ).not.toBeVisible();
  await page.getByLabel("Language", { exact: true }).selectOption("de");
  await expect(page.locator(".csv-import").getByRole("alert")).toContainText(
    "Spalten",
  );
  await page
    .getByRole("button", { name: "Dunkles Design", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".csv-import").getByRole("alert")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
