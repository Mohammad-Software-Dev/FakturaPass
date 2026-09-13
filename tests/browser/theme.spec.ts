import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const fixture = readFileSync("fixtures/valid/FP-A-001.json", "utf8");
test("theme persists in server HTML and preserves language and unsaved drafts", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Rechnung importieren", exact: true })
    .click();
  await page.locator("#canonical").fill(fixture);
  await page
    .getByRole("button", { name: "Dunkles Design", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Dunkles Design", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#canonical")).toHaveValue(fixture);
  await page.getByLabel("Sprache", { exact: true }).selectOption("en");
  await expect(
    page.getByRole("button", { name: "Dark appearance", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const html = await (await page.request.get("/")).text();
  expect(html).toContain('data-theme="dark"');
  await expect(page.getByLabel("Language", { exact: true })).toHaveValue("en");
  await page
    .getByRole("button", { name: "Dark appearance", exact: true })
    .click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
test("both themes have readable surfaces, responsive controls and reduced motion", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Rechnung importieren", exact: true })
    .click();
  await page.getByLabel("JSON-Datei auswählen", { exact: true }).setInputFiles({
    name: "demo.json",
    mimeType: "application/json",
    buffer: Buffer.from(fixture),
  });
  await page.getByRole("button", { name: "Vorschau prüfen" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["light", "dark"]) {
    if (theme === "dark")
      await page
        .getByRole("button", { name: "Dunkles Design", exact: true })
        .click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    const ratios = await page.evaluate(() => {
      const luminance = (rgb: string) => {
        const c = rgb
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((n) => {
            n /= 255;
            return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
          });
        return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
      };
      return [
        "body",
        ".panel",
        ".code-editor",
        ".primary",
        ".theme-toggle",
        ".language-switcher select",
      ].map((selector) => {
        const el = document.querySelector(selector)!;
        const style = getComputedStyle(el);
        let bg = style.backgroundColor;
        let parent = el.parentElement;
        while (bg === "rgba(0, 0, 0, 0)" && parent) {
          bg = getComputedStyle(parent).backgroundColor;
          parent = parent.parentElement;
        }
        const a = luminance(style.color),
          b = luminance(bg);
        return {
          selector,
          ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        };
      });
    });
    for (const { selector, ratio } of ratios)
      expect(ratio, `${theme}: ${selector}`).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({
      path: testInfo.outputPath(`${theme}-desktop.png`),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole("button", { name: "Dunkles Design", exact: true }),
    ).toBeVisible();
    expect(
      await page.locator("body").evaluate((el) => el.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: testInfo.outputPath(`${theme}-mobile.png`),
      fullPage: true,
    });
    expect(
      await page
        .locator(".theme-toggle")
        .evaluate((el) => getComputedStyle(el).transitionDuration),
    ).toBe("0s");
  }
});
