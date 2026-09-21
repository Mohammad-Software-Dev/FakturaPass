"use client";
import { useEffect, useState, useRef } from "react";
import { useLanguage } from "../language";
import { AppearanceControls } from "../theme";
export function Join() {
  const { t, intlLocale } = useLanguage();
  const secretRef = useRef<string | null>(null);
  const [token, setToken] = useState(""),
    [invite, setInvite] = useState<{
      organization: string;
      email: string;
      role: string;
      expiresAt: string;
    } | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    const secret = secretRef.current ?? window.location.hash.slice(1);
    secretRef.current = secret;
    window.history.replaceState(null, "", "/join");
    if (!secret) {
      setError(true);
      return;
    }
    const controller = new AbortController();
    fetch("/api/v1/auth/invitation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: secret }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw Error();
        setInvite(await response.json());
        setToken(secret);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(true);
      });
    return () => controller.abort();
  }, []);
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
          <h1>{t("Einladung zu Ihrem Team")}</h1>
          {error ? (
            <p role="alert">
              {t(
                "Diese Einladung ist nicht verfügbar. Bitte bitten Sie Ihre Administration um einen neuen Link.",
              )}
            </p>
          ) : !invite ? (
            <p role="status">{t("Einladung wird geprüft …")}</p>
          ) : (
            <>
              <h2>{invite.organization}</h2>
              <p>
                {invite.email}
                <br />
                {t(roles[invite.role])}
              </p>
              <p>
                {t("Gültig bis")}{" "}
                {new Intl.DateTimeFormat(intlLocale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(invite.expiresAt))}
              </p>
              <p>
                {t(
                  "Melden Sie sich mit der eingeladenen, bestätigten E-Mail-Adresse an, um dem Team beizutreten.",
                )}
              </p>
              <p>
                {t(
                  "Bestehende Teammitglieder behalten ihre bisherigen Rechte.",
                )}
              </p>
              <form action="/api/v1/auth/join" method="post">
                <input type="hidden" name="token" value={token} />
                <button className="primary">
                  {t("Anmelden und beitreten")}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
