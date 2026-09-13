"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { LanguageSwitcher, useLanguage } from "./language";
export type Theme = "light" | "dark";
const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(
  null,
);
export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState(initialTheme);
  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggle: () => {
          const next = theme === "light" ? "dark" : "light";
          document.documentElement.dataset.theme = next;
          document.cookie = `fakturapass-theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
          setTheme(next);
        },
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
export function AppearanceControls() {
  const context = useContext(ThemeContext);
  const { t } = useLanguage();
  if (!context) throw new Error("ThemeProvider is required");
  const dark = context.theme === "dark";
  return (
    <div className="appearance-controls">
      <LanguageSwitcher />
      <button
        className="theme-toggle"
        type="button"
        aria-label={t("Dunkles Design")}
        aria-pressed={dark}
        title={t(
          dark ? "Zum hellen Design wechseln" : "Zum dunklen Design wechseln",
        )}
        onClick={context.toggle}
      >
        {dark ? <Sun size={17} /> : <Moon size={17} />}
        <span>{t(dark ? "Dunkel" : "Hell")}</span>
      </button>
    </div>
  );
}
