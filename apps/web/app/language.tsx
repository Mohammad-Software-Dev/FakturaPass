"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  type Locale,
  resolveLocale,
  isLocale,
  locales,
  localeCookie,
  translate,
  date,
  money,
  decimal,
} from "../../../packages/i18n";
const LanguageContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
} | null>(null);
export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocale] = useState(initialLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = translate(locale, "FakturaPass · Rechnungen prüfen");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        "content",
        translate(locale, "Lokaler XRechnung-Prüfungsarbeitsplatz"),
      );
  }, [locale]);
  return (
    <LanguageContext.Provider
      value={{
        locale,
        setLocale: (value) => {
          const next = resolveLocale(value);
          document.cookie = `${localeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
          setLocale(next);
        },
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("LanguageProvider is required");
  const { locale } = context;
  return {
    ...context,
    intlLocale: locales[locale].intl,
    t: (key: string, values?: Record<string, string | number>) =>
      translate(locale, key, values),
    date: (value: string) => date(locale, value),
    money: (value: string) => money(locale, value),
    decimal: (value: string) => decimal(locale, value),
  };
}
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLanguage();
  return (
    <label className="language-switcher">
      <span>{t("Sprache")}</span>
      <select
        aria-label={t("Sprache")}
        value={locale}
        onChange={(event) => {
          if (isLocale(event.target.value)) setLocale(event.target.value);
        }}
      >
        {Object.entries(locales).map(([code, config]) => (
          <option key={code} value={code} lang={code}>
            {config.label}
          </option>
        ))}
      </select>
    </label>
  );
}
