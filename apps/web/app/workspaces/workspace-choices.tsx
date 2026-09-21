"use client";
import { useLanguage } from "../language";
import { AppearanceControls } from "../theme";
export function WorkspaceChoices({
  items,
}: {
  items: { id: string; name: string; role: string }[];
}) {
  const { t } = useLanguage();
  const roles: Record<string, string> = {
    ADMIN: "Administration",
    OPERATOR: "Sachbearbeitung",
    APPROVER: "Freigabe",
    READ_ONLY: "Nur lesen",
  };
  return (
    <main className="sign-in-shell">
      <div className="sign-in-preferences">
        <AppearanceControls />
      </div>
      <section className="panel sign-in-card">
        <div className="panel-body">
          <div className="eyebrow">FakturaPass</div>
          <h1>{t("Wählen Sie Ihren Arbeitsbereich")}</h1>
          <p>
            {t(
              "Jeder Arbeitsbereich hat eigene Rechnungen und Zugriffsrechte.",
            )}
          </p>
          {items.length ? (
            <nav
              className="workspace-choices"
              aria-label={t("Arbeitsbereiche")}
            >
              {items.map((item) => (
                <a
                  key={item.id}
                  href={`/?workspace=${encodeURIComponent(item.id)}`}
                >
                  <strong>{item.name}</strong>
                  <span>{t(roles[item.role] ?? item.role)}</span>
                </a>
              ))}
            </nav>
          ) : (
            <p role="status">
              {t(
                "Sie haben derzeit keinen aktiven Arbeitsbereich. Bitte wenden Sie sich an Ihre Administration.",
              )}
            </p>
          )}
          <form action="/api/v1/auth/logout" method="post">
            <button className="secondary">
              {t("Von FakturaPass abmelden")}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
