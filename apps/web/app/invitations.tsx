"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "./language";
import { workspaceFetch } from "./workspace-request";
const roleLabels: Record<string, string> = {
  ADMIN: "Administration",
  OPERATOR: "Sachbearbeitung",
  APPROVER: "Freigabe",
  READ_ONLY: "Nur lesen",
};
const statusLabels: Record<string, string> = {
  PENDING: "Einladung offen",
  ACCEPTED: "Einladung angenommen",
  REVOKED: "Einladung wurde widerrufen",
  EXPIRED: "Einladung abgelaufen",
  UNAVAILABLE: "Einladung nicht mehr verfügbar",
};
type Invite = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
};
export function Invitations() {
  const { t, intlLocale } = useLanguage();
  const [items, setItems] = useState<Invite[]>([]),
    [email, setEmail] = useState(""),
    [role, setRole] = useState("READ_ONLY"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [url, setUrl] = useState(""),
    [copied, setCopied] = useState(false);
  async function refresh() {
    const response = await workspaceFetch("/api/v1/invitations");
    if (!response.ok) throw Error();
    setItems((await response.json()).items);
  }
  useEffect(() => {
    refresh().catch(() => setError(true));
  }, []);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    setUrl("");
    setCopied(false);
    try {
      const response = await workspaceFetch("/api/v1/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (!response.ok) throw Error();
      setUrl((await response.json()).url);
      await refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    setBusy(true);
    setError(false);
    try {
      const response = await workspaceFetch(`/api/v1/invitations/${id}`, {
        method: "POST",
      });
      if (!response.ok) throw Error();
      setUrl("");
      await refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>{t("Team einladen")}</h2>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => {
            setError(false);
            refresh().catch(() => setError(true));
          }}
        >
          {t("Aktualisieren")}
        </button>
      </div>
      <div className="panel-body">
        <p>
          {t(
            "Erstellen Sie einen Link und teilen Sie ihn mit der eingeladenen Person. Es wird keine E-Mail versendet.",
          )}
        </p>
        <p>
          {t(
            "Der Link gilt 72 Stunden. Die Anmeldung muss dieselbe, bestätigte E-Mail-Adresse verwenden. Ein neuer Link ersetzt eine offene Einladung an diese Adresse.",
          )}
        </p>
        <form className="invitation-form" onSubmit={create}>
          <label>
            {t("E-Mail-Adresse")}
            <input
              type="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            {t("Rolle")}
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {t(label)}
                </option>
              ))}
            </select>
          </label>
          <button className="primary" disabled={busy}>
            {t("Einladungslink erstellen")}
          </button>
        </form>
        {error && (
          <p role="alert" className="error-banner">
            {t(
              "Die Einladung konnte nicht verarbeitet werden. Bitte prüfen Sie Ihre Rechte und versuchen Sie es erneut.",
            )}
          </p>
        )}
        {url && (
          <div className="invitation-link">
            <label>
              {t("Einladungslink")}
              <input readOnly value={url} onFocus={(e) => e.target.select()} />
            </label>
            <button
              className="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {t("Link kopieren")}
            </button>
            <p role="status">
              {t(
                copied
                  ? "Link kopiert."
                  : "Kopieren Sie diesen Link jetzt. Er wird nur einmal angezeigt.",
              )}
            </p>
          </div>
        )}
        <div className="workspace-choices">
          {items.map((item) => (
            <article className="invitation-item" key={item.id}>
              <strong>{item.email}</strong>
              <span>
                {t(roleLabels[item.role])} · {t(statusLabels[item.status])}
              </span>
              <small>
                {t("Gültig bis")}{" "}
                {new Intl.DateTimeFormat(intlLocale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(item.expiresAt))}
              </small>
              {!["ACCEPTED", "REVOKED"].includes(item.status) && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => revoke(item.id)}
                >
                  {t("Einladung widerrufen")}
                </button>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
