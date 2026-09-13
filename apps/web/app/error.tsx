"use client";
import { AppearanceControls } from "./theme";
import { useLanguage } from "./language";
export default function ErrorView({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const { t } = useLanguage();
  return (
    <main className="standalone-message">
      <AppearanceControls />
      <div role="alert">
        <h1>{t("Die Ansicht konnte nicht geladen werden.")}</h1>
        <p>
          {t(
            "Bitte versuchen Sie es erneut. Ihre gespeicherten Rechnungen bleiben erhalten.",
          )}
        </p>
      </div>
      <button className="primary" onClick={retry}>
        {t("Erneut versuchen")}
      </button>
      <a className="text-button" href="/">
        {t("Zum Arbeitsbereich")}
      </a>
    </main>
  );
}
