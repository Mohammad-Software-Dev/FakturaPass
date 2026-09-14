import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test("claim a review, finish the invoice and clear its queue entry", async ({
  page,
}, info) => {
  await page.context().addCookies([
    {
      name: "fakturapass-language",
      value: "en",
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3010",
    },
  ]);
  const invoice = JSON.parse(
    readFileSync("fixtures/valid/FP-A-001.json", "utf8"),
  );
  invoice.source.recordId = `review-${info.project.name}-${Date.now()}`;
  invoice.document.number = invoice.source.recordId;
  await page.goto("/");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.locator("#canonical").fill(JSON.stringify(invoice));
  await page
    .getByRole("button", { name: "Check preview", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Import invoice", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: invoice.document.number, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "All invoices", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review queue", exact: true }).click();
  const card = page
    .locator(".review-item")
    .filter({ hasText: invoice.document.number });
  await expect(card).toContainText("Validation needed");
  await card.getByRole("button", { name: "Assign to me", exact: true }).click();
  await expect(card).toContainText("Assigned to you");
  await page.getByRole("button", { name: /^My invoices/ }).click();
  await expect(card).toBeVisible();
  await page.getByLabel("Language", { exact: true }).selectOption("de");
  await expect(
    page.getByRole("heading", {
      name: "Gemeinsam zur fertigen Rechnung",
      exact: true,
    }),
  ).toBeVisible();
  await expect(card).toContainText("Von Ihnen übernommen");
  await page
    .getByRole("button", { name: "Dunkles Design", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Sprache", { exact: true }).selectOption("en");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await card.getByRole("button", { name: "Edit invoice", exact: true }).click();
  await page.getByRole("button", { name: "Validate", exact: true }).click();
  await page
    .getByRole("button", { name: "Approve revision", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Generate XRechnung", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Download XML", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review queue", exact: true }).click();
  await page.getByRole("button", { name: /^My invoices/ }).click();
  await expect(
    page.locator(".review-item").filter({ hasText: invoice.document.number }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "Nothing needs attention here.",
      exact: true,
    }),
  ).toBeVisible();
});
