import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test("recipient profile creation, version history and bilingual dark mobile review", async ({
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
  await page.getByRole("button", { name: "Recipients", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Recipient requirements", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add recipient", exact: true })
    .click();
  const name = `Purchasing ${info.project.name} ${Date.now()}`;
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page
    .getByLabel("Profile key", { exact: true })
    .fill(`browser-${info.project.name}-${Date.now()}`);
  await page.getByLabel("Address scheme", { exact: true }).fill("EM");
  await page
    .getByRole("textbox", { name: "Recipient electronic address", exact: true })
    .fill("buyer@example.invalid");
  await page.getByLabel("Purchase order reference", { exact: true }).check();
  await page
    .getByRole("button", { name: "Save profile version", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Profile version saved");
  const card = page
    .locator(".recipient-grid .panel")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
  await expect(card).toContainText("Requirements unverified");
  await card
    .getByRole("button", { name: "New profile version", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill(name + " updated");
  await page
    .getByLabel("Evidence status", { exact: true })
    .selectOption("TENANT_VERIFIED");
  await page
    .getByLabel("Review again before", { exact: true })
    .fill(new Date(Date.now() + 604800000).toISOString().slice(0, 10));
  await page
    .getByLabel("Source title", { exact: true })
    .fill("Synthetic instructions");
  await page
    .getByLabel("Link or document reference", { exact: true })
    .fill("fixture:reviewed-instructions");
  await page.getByLabel("Retrieved", { exact: true }).fill("2026-01-01");
  await page
    .getByLabel("Evidence reviewed on", { exact: true })
    .fill("2026-01-02");
  await expect(
    page.getByRole("button", { name: "Save profile version", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel(
      "I have reviewed the source and its applicability to this recipient.",
      { exact: true },
    )
    .check();
  await page
    .getByRole("button", { name: "Save profile version", exact: true })
    .click();
  const updated = page.locator(".recipient-grid .panel").filter({
    has: page.getByRole("heading", { name: name + " updated", exact: true }),
  });
  await updated
    .getByRole("button", { name: "Version history", exact: true })
    .click();
  await expect(
    page.locator("details summary").filter({ hasText: name }),
  ).toHaveCount(2);
  await page.getByLabel("Language", { exact: true }).selectOption("de");
  await expect(
    page.getByRole("heading", { name: "Empfängeranforderungen", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Dunkles Design", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("evidenced recipient selection links requirement failures to their source", async ({
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
  invoice.source.recordId = `recipient-${info.project.name}-${Date.now()}`;
  invoice.document.purchaseOrderReference = null;
  const profile = {
    ...JSON.parse(readFileSync("examples/recipient-profile.json", "utf8")),
    recipientKey: `rule-${info.project.name}-${Date.now()}`,
    displayName: `Purchasing rule ${info.project.name}`,
    identifiers: [invoice.buyer.electronicAddress],
    status: "TENANT_VERIFIED",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    evidence: [
      {
        sourceType: "TEST",
        title: "Synthetic purchasing instructions",
        urlOrReference: "fixture:browser-purchasing",
        retrievedAt: "2026-01-01T00:00:00Z",
        reviewedAt: "2026-01-02T00:00:00Z",
        effectiveFrom: null,
      },
    ],
  };
  const response = await page.request.post("/api/v1/recipient-profiles", {
    headers: {
      Origin: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3010",
    },
    data: { profile, priorVersionId: null },
  });
  expect(response.status()).toBe(201);
  const saved = await response.json();
  await page.goto("/");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByLabel("Choose JSON file", { exact: true }).setInputFiles({
    name: "invoice.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(invoice)),
  });
  await page
    .getByRole("button", { name: "Check preview", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Import invoice", exact: true })
    .click();
  await page
    .getByLabel("Reference check", { exact: true })
    .selectOption(saved.versionId);
  await page.getByText("Requirements and evidence", { exact: true }).click();
  await expect(page.locator(".profile-selection")).toContainText(
    "Synthetic purchasing instructions",
  );
  await page.getByRole("button", { name: "Validate", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Approve revision", exact: true }),
  ).not.toBeVisible();
  await page.getByRole("tab", { name: /Validation results/ }).click();
  await expect(page.locator("main")).toContainText(
    "fixture:browser-purchasing",
  );
});
