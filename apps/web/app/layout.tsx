import type { Metadata } from "next";
import { cookies } from "next/headers";
import { localeCookie, resolveLocale, translate } from "../../../packages/i18n";
import { LanguageProvider } from "./language";
import { ThemeProvider } from "./theme";
import "./globals.css";
async function currentLocale() {
  return resolveLocale((await cookies()).get(localeCookie)?.value);
}
export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  return {
    title: translate(locale, "FakturaPass · Rechnungen prüfen"),
    description: translate(locale, "Lokaler XRechnung-Prüfungsarbeitsplatz"),
  };
}
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await currentLocale();
  const theme =
    (await cookies()).get("fakturapass-theme")?.value === "dark"
      ? "dark"
      : "light";
  return (
    <html lang={locale} data-theme={theme}>
      <body>
        <LanguageProvider initialLocale={locale}>
          <ThemeProvider initialTheme={theme}>{children}</ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
