"use client";
import { useLanguage } from "../language";
import { AppearanceControls } from "../theme";
export function SignIn({
  error,
  loggedOut,
}: {
  error: string;
  loggedOut: boolean;
}) {
  const { t } = useLanguage();
  return (
    <main className="sign-in-shell">
      <div className="sign-in-preferences">
        <AppearanceControls />
      </div>
      <section className="panel sign-in-card">
        <div className="panel-body">
          <div className="eyebrow">FakturaPass</div>
          <h1>{t("Willkommen in Ihrem Arbeitsbereich")}</h1>
          <p>
            {t(
              "Melden Sie sich an, um Rechnungen zu prüfen und gemeinsam weiterzubearbeiten.",
            )}
          </p>
          {error && (
            <p role="alert" className="error-banner">
              {t(
                error === "access"
                  ? "Für dieses Konto ist kein eindeutiger aktiver Arbeitsbereich verfügbar. Bitte wenden Sie sich an Ihre Administration."
                  : "Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.",
              )}
            </p>
          )}
          {loggedOut && (
            <p role="status">{t("Sie sind von FakturaPass abgemeldet.")}</p>
          )}
          <form action="/api/v1/auth/login" method="post">
            <button className="primary">{t("Sicher anmelden")}</button>
          </form>
          <p className="muted">
            {t("Sie werden zur Anmeldung Ihres Unternehmens weitergeleitet.")}
          </p>
        </div>
      </section>
    </main>
  );
}
