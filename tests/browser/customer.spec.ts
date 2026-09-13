import { test, expect } from "@playwright/test";
test("customer workspace keeps setup noise out of the primary flow", async ({
  page,
  context,
}, testInfo) => {
  await context.addCookies([
    {
      name: "fakturapass-language",
      value: "en",
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3010",
    },
  ]);
  await page.route("**/api/v1/invoices?*", (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your invoices" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ready for your first invoice." }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /demo|demonstrator|RELEASE A/i,
  );
  await expect(
    page.getByRole("button", { name: "Import invoice", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Import invoice", exact: true })
    .click();
  await expect(
    page.getByLabel("Invoice data (JSON)", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("#fixture")).not.toBeVisible();
  await page.getByText("See a format example", { exact: true }).click();
  await expect(page.locator("#fixture option")).toHaveCount(2);
  await page.locator("#fixture").selectOption("0");
  await expect(page.locator("#canonical")).toHaveValue(/Nordlicht/);
  await page.getByRole("button", { name: "Check preview" }).click();
  await expect(page.locator(".preview-amount")).toHaveText("€2,045.61");
  await page.getByText("See a format example", { exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("customer-light.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Dark appearance", exact: true })
    .click();
  await page.screenshot({
    path: testInfo.outputPath("customer-dark.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Settings & information", exact: true })
    .click();
  await expect(
    page.getByText("Local installation", { exact: true }),
  ).not.toBeVisible();
  await page.getByText("Technical information", { exact: true }).click();
  await expect(
    page.getByText("Local installation", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Technical validation does not confirm/),
  ).toBeVisible();
});
