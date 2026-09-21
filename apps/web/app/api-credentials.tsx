"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "./language";
import { workspaceFetch } from "./workspace-request";
import {
  credentialScopes,
  type CredentialScope,
} from "../../../packages/identity/credential-scopes";
type Credential = {
  id: string;
  name: string;
  owner: string;
  environment: string;
  scopes: CredentialScope[];
  version: number;
  status: string;
  expiresAt: string;
  lastUsedAt: string | null;
};
const statuses: Record<string, string> = {
  ACTIVE: "Aktiv",
  REVOKED: "Widerrufen",
  EXPIRED: "Abgelaufen",
  UNAVAILABLE: "Nicht verfügbar",
};
export function ApiCredentials({ actor }: { actor: string }) {
  const { t, intlLocale } = useLanguage();
  const [items, setItems] = useState<Credential[]>([]),
    [name, setName] = useState(""),
    [days, setDays] = useState(30),
    [scopes, setScopes] = useState<CredentialScope[]>(["invoices:read"]),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(false),
    [secret, setSecret] = useState(""),
    [copied, setCopied] = useState(false),
    [confirmation, setConfirmation] = useState<{
      item: Credential;
      action: "rotate" | "revoke";
    } | null>(null);
  async function refresh() {
    const response = await workspaceFetch("/api/v1/api-credentials");
    if (!response.ok) throw Error();
    setItems((await response.json()).items);
  }
  useEffect(() => {
    refresh()
      .catch(() => setError(true))
      .finally(() => setBusy(false));
  }, []);
  async function mutate(path: string, body: object) {
    setBusy(true);
    setError(false);
    setSecret("");
    setCopied(false);
    setConfirmation(null);
    try {
      const response = await workspaceFetch("/api/v1/api-credentials" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw Error();
      const data = await response.json();
      setSecret(data.secret ?? "");
      await refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  const date = (value: string) =>
    new Intl.DateTimeFormat(intlLocale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  return (
    <section className="panel credential-panel">
      <div className="panel-title">
        <h2>{t("API-Zugänge")}</h2>
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
            "Verbinden Sie Ihre Software mit diesem Arbeitsbereich. Wählen Sie nur die benötigten Rechte. Ihre aktuelle Teamrolle begrenzt jeden Zugriff.",
          )}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void mutate("", { name, scopes, expiresInDays: days });
          }}
        >
          <div className="invitation-form">
            <label>
              {t("Bezeichnung")}
              <input
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
              />
            </label>
            <label>
              {t("Gültigkeit in Tagen")}
              <input
                type="number"
                min={1}
                max={90}
                required
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                disabled={busy}
              />
            </label>
          </div>
          <fieldset className="credential-scopes">
            <legend>{t("Berechtigungen")}</legend>
            {Object.entries(credentialScopes).map(([scope, label]) => (
              <label key={scope}>
                <input
                  type="checkbox"
                  checked={scopes.includes(scope as CredentialScope)}
                  disabled={busy}
                  onChange={(e) =>
                    setScopes((current) =>
                      e.target.checked
                        ? [...current, scope as CredentialScope]
                        : current.filter((s) => s !== scope),
                    )
                  }
                />
                {t(label)}
              </label>
            ))}
          </fieldset>
          <button className="primary" disabled={busy || !scopes.length}>
            {t("API-Schlüssel erstellen")}
          </button>
        </form>
        {error && (
          <p role="alert" className="error-banner">
            {t(
              "Der API-Zugang konnte nicht verarbeitet werden. Aktualisieren Sie die Liste und prüfen Sie Ihre Rechte.",
            )}
          </p>
        )}
        {secret && (
          <div className="invitation-link">
            <label>
              {t("Neuer API-Schlüssel")}
              <input
                readOnly
                value={secret}
                onFocus={(e) => e.target.select()}
              />
            </label>
            <p>
              {t(
                "Speichern Sie diesen Schlüssel jetzt sicher. Er wird nur einmal angezeigt. Senden Sie ihn als X-API-Key im Anfrage-Header; niemals in einer URL.",
              )}
            </p>
            <button
              className="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(secret);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {t("Schlüssel kopieren")}
            </button>
            <button className="secondary" onClick={() => setSecret("")}>
              {t("Schlüssel ausblenden")}
            </button>
            {copied && <p role="status">{t("Schlüssel kopiert.")}</p>}
          </div>
        )}
        {confirmation && (
          <div
            className="invitation-link"
            role="group"
            aria-label={t("Änderung bestätigen")}
          >
            <strong>{confirmation.item.name}</strong>
            <p>
              {t(
                confirmation.action === "rotate"
                  ? "Der bisherige Schlüssel wird sofort ungültig. Ersetzen Sie ihn anschließend in Ihrer Software. Rechte und Ablaufdatum bleiben gleich."
                  : "Dieser Schlüssel wird dauerhaft gesperrt. Die verbundene Software verliert ihren Zugang.",
              )}
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void mutate(`/${confirmation.item.id}/${confirmation.action}`, {
                  expectedVersion: confirmation.item.version,
                })
              }
            >
              {t("Änderung bestätigen")}
            </button>
            <button className="secondary" onClick={() => setConfirmation(null)}>
              {t("Abbrechen")}
            </button>
          </div>
        )}
        {!busy && !items.length && (
          <p>{t("Noch keine API-Zugänge vorhanden.")}</p>
        )}
        <div className="workspace-choices">
          {items.map((item) => (
            <article className="invitation-item" key={item.id}>
              <strong>{item.name}</strong>
              <span>
                {t(statuses[item.status])} · {item.environment}
              </span>
              <small>
                {t("Gültig bis")} {date(item.expiresAt)}
              </small>
              <small>
                {t("Zuletzt verwendet")}:{" "}
                {item.lastUsedAt
                  ? date(item.lastUsedAt)
                  : t("Noch nicht verwendet")}
              </small>
              <p>
                {item.scopes
                  .map((scope) => t(credentialScopes[scope]))
                  .join(" · ")}
              </p>
              {item.status === "ACTIVE" && item.owner === actor && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => setConfirmation({ item, action: "rotate" })}
                >
                  {t("Schlüssel ersetzen")}
                </button>
              )}
              {item.status !== "REVOKED" && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => setConfirmation({ item, action: "revoke" })}
                >
                  {t("Zugang widerrufen")}
                </button>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
