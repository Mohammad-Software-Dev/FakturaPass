import { test, expect } from "@playwright/test";
test("administrator manages existing member access in English and German", async ({
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
  await page.getByRole("button", { name: "Team access", exact: true }).click();
  const card = page
    .locator(".team-member")
    .filter({ has: page.getByRole("heading", { name: "r", exact: true }) });
  await expect(card).toBeVisible();
  await card.getByLabel("Role", { exact: true }).selectOption("OPERATOR");
  await card.getByRole("button", { name: "Save access", exact: true }).click();
  await expect(
    card.getByRole("button", { name: "Save access", exact: true }),
  ).toBeDisabled();
  await expect(
    card.getByText("Operator · Active", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Language", { exact: true }).selectOption("de");
  await page
    .getByRole("button", { name: "Dunkles Design", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await card.getByLabel("Zugang", { exact: true }).selectOption("SUSPENDED");
  await card
    .getByRole("button", { name: "Zugriff speichern", exact: true })
    .click();
  await expect(
    card.getByText("Sachbearbeitung · Gesperrt", { exact: true }),
  ).toBeVisible();
  await card.getByLabel("Rolle", { exact: true }).selectOption("READ_ONLY");
  await card.getByLabel("Zugang", { exact: true }).selectOption("ACTIVE");
  await card
    .getByRole("button", { name: "Zugriff speichern", exact: true })
    .click();
  await expect(
    card.getByText("Nur lesen · Aktiv", { exact: true }),
  ).toBeVisible();
});
