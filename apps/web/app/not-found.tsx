"use client";
import { AppearanceControls } from "./theme";
import { useLanguage } from "./language";
export default function NotFound() {
  const { t } = useLanguage();
  return (
    <main className="standalone-message">
      <AppearanceControls />
      <p>404 · FakturaPass</p>
      <h1>{t("Seite nicht gefunden")}</h1>
      <p>
        {t(
          "Diese Adresse ist nicht verfügbar. Öffnen Sie den Rechnungsarbeitsplatz.",
        )}
      </p>
      <a className="primary" href="/">
        {t("Zum Arbeitsbereich")}
      </a>
    </main>
  );
}
