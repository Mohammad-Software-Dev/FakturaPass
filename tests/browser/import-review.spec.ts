import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
for (const name of ["consulting", "office-equipment", "brand-project"]) {
  test(`${name}: complete preview, correction, duplicate recovery and export`, async ({
    page,
  }, testInfo) => {
    await page.context().addCookies([
      {
        name: "fakturapass-language",
        value: "en",
        url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3010",
      },
    ]);
    const input = JSON.parse(
      readFileSync(`examples/customer-invoice-${name}.json`, "utf8"),
    );
    input.source.recordId += `-ux-${testInfo.project.name}-${Date.now()}`;
    const upload = JSON.stringify(input, null, 2);
    await page.goto("/");
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await page
      .getByRole("button", { name: "Choose JSON file", exact: true })
      .setInputFiles({
        name: `${name}.json`,
        mimeType: "application/json",
        buffer: Buffer.from(upload),
      });
    await page
      .getByRole("button", { name: "Check preview", exact: true })
      .click();
    await expect(page.locator(".preview-panel")).toContainText(
      input.seller.name,
    );
    await expect(page.locator(".preview-panel")).toContainText(
      input.lines[0].description,
    );
    await expect(page.locator(".preview-panel")).toContainText(
      input.payment.terms,
    );
    if (name === "office-equipment")
      await expect(page.locator(".review-totals")).toContainText("€137.05");
    if (name === "brand-project") {
      await expect(page.locator(".review-totals")).toContainText("€2,739.98");
      await expect(page.locator(".review-totals")).toContainText("€500.00");
    }
    await page
      .getByRole("button", { name: "Import invoice", exact: true })
      .click();
    await expect(page.locator(".detail-amount")).toContainText("Amount due");
    await page
      .getByRole("button", { name: "Corrected revision", exact: true })
      .click();
    await expect(page.locator(".preview-panel")).toContainText(
      input.document.number,
    );
    await expect(page.locator("#canonical")).not.toBeVisible();
    await page
      .getByRole("textbox", { name: "Buyer reference", exact: true })
      .fill("CUSTOMER-REVIEW");
    await page
      .getByRole("button", { name: "Check preview", exact: true })
      .click();
    await expect(page.locator(".change-summary")).toContainText(
      "CUSTOMER-REVIEW",
    );
    await expect(page.locator(".change-summary")).toContainText(
      input.document.buyerReference,
    );
    await page
      .getByRole("button", {
        name: "Cancel and return to invoice",
        exact: true,
      })
      .click();
    await expect(page.locator(".invoice-review")).toContainText(
      input.document.buyerReference,
    );
    await page
      .getByRole("button", { name: "Corrected revision", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Buyer reference", exact: true })
      .fill("CUSTOMER-REVIEW");
    await page
      .getByRole("button", { name: "Check preview", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save new revision", exact: true })
      .click();
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
    await expect(page.locator(".workflow-guidance")).toContainText(
      "has not been sent",
    );
    const href = await page
      .getByRole("link", { name: "Download XML", exact: true })
      .getAttribute("href");
    expect((await page.request.get(href!)).status()).toBe(200);
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await page.locator("#canonical").fill(upload);
    await page
      .getByRole("button", { name: "Check preview", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Import invoice", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Open existing invoice", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: input.document.number, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".invoice-review")).toContainText(
      "CUSTOMER-REVIEW",
    );
  });
}

test("form calculation, inline errors and mobile preview preserve the source", async ({
  page,
}, testInfo) => {
  await page.context().addCookies([
    {
      name: "fakturapass-language",
      value: "en",
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3010",
    },
  ]);
  const input = readFileSync(
    "examples/customer-invoice-brand-project.json",
    "utf8",
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.locator("#canonical").fill(input);
  await page
    .getByRole("button", { name: "Check preview", exact: true })
    .click();
  await page.locator(".advanced-json summary").click();
  const edited = JSON.parse(input);
  edited.document.buyerReference = "FROM-JSON";
  await page.locator("#canonical").fill(JSON.stringify(edited));
  await expect(page.locator(".invoice-editor")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Check preview", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Buyer reference", exact: true }),
  ).toHaveValue("FROM-JSON");
  await page.getByRole("button", { name: "Line items", exact: true }).click();
  await page.locator('[data-field="lines.0.quantity"]').fill("");
  await expect(page.locator('[data-field="lines.0.quantity"]')).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page
    .getByRole("button", { name: "Recalculate amounts", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Cannot calculate");
  await page.locator('[data-field="lines.0.quantity"]').fill("15");
  await page
    .getByRole("button", { name: "Recalculate amounts", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Check preview", exact: true })
    .click();
  await expect(page.locator(".preview-amount")).toHaveText("€2,272.70");
  await expect(page.locator(".review-totals")).toContainText("€500.00");
  await page.getByLabel("Language", { exact: true }).selectOption("de");
  await expect(page.locator(".preview-amount")).toContainText("2.272,70");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Vorschau prüfen", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("review-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Dunkles Design", exact: true })
    .click();
  await page.screenshot({
    path: testInfo.outputPath("review-dark.png"),
    fullPage: true,
  });
});
