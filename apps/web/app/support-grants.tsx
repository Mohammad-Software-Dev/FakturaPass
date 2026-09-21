"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "./language";
import { workspaceFetch } from "./workspace-request";
export type SupportGrant = {
  id: string;
  agentName: string;
  workspaceName: string;
  invoiceNumber: string;
  revisionNumber: number;
  reason: string;
  status: string;
  expiresAt: string;
  lastViewedAt: string | null;
};
const statuses: Record<string, string> = {
  ACTIVE: "Aktiv",
  EXPIRED: "Abgelaufen",
  REVOKED: "Widerrufen",
  UNAVAILABLE: "Nicht verfügbar",
};
export function SupportGrants() {
  const { t, intlLocale } = useLanguage();
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]),
    [items, setItems] = useState<SupportGrant[]>([]),
    [invoices, setInvoices] = useState<
      {
        invoiceId: string;
        currentRevisionId: string;
        revisionNumber: number;
        documentNumber: string;
      }[]
    >([]),
    [cursor, setCursor] = useState<string | null>(null),
    [agent, setAgent] = useState(""),
    [revision, setRevision] = useState(""),
    [reason, setReason] = useState(""),
    [hours, setHours] = useState(1),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(false),
    [notice, setNotice] = useState(false);
  async function json(path: string, options?: RequestInit) {
    const r = await workspaceFetch("/api/v1/" + path, options);
    if (!r.ok) throw Error();
    return r.json();
  }
  async function refresh() {
    setItems((await json("support-grants")).items);
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      json("support-agents"),
      json("support-grants"),
      json("invoices?limit=100"),
    ])
      .then(([a, g, i]) => {
        if (active) {
          setAgents(a.items);
          setItems(g.items);
          setInvoices(i.items);
          setCursor(i.nextCursor);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    setNotice(false);
    try {
      const invoice = invoices.find((i) => i.currentRevisionId === revision);
      await json("support-grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent,
          invoiceId: invoice?.invoiceId,
          revisionId: revision,
          reason,
          hours,
          consent,
        }),
      });
      setConsent(false);
      setNotice(true);
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
    <section className="panel support-grants-panel">
      <div className="panel-title">
        <h2>{t("Supportzugriff")}</h2>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => {
            setError(false);
            setBusy(true);
            setConsent(false);
            setRevision("");
            Promise.all([
              json("support-agents"),
              json("invoices?limit=100"),
              refresh(),
            ])
              .then(([a, i]) => {
                setAgents(a.items);
                setInvoices(i.items);
                setCursor(i.nextCursor);
              })
              .catch(() => setError(true))
              .finally(() => setBusy(false));
          }}
        >
          {t("Aktualisieren")}
        </button>
      </div>
      <div className="panel-body">
        <p>
          {t(
            "Geben Sie einer registrierten Supportperson vorübergehend Einblick in eine bestimmte Rechnungsversion. Sie kann Rechnungsdaten und gespeicherte Prüfergebnisse lesen, aber nichts ändern, freigeben oder herunterladen.",
          )}
        </p>
        {!busy && !agents.length ? (
          <p>
            {t(
              "Derzeit ist keine Supportperson registriert. Wenden Sie sich an Ihren Ansprechpartner; es wurde kein Zugriff erteilt.",
            )}
          </p>
        ) : (
          <form onSubmit={create}>
            <div className="support-form">
              <label>
                {t("Supportperson")}
                <select
                  required
                  disabled={busy}
                  aria-label={t("Supportperson")}
                  value={agent}
                  onChange={(e) => {
                    setAgent(e.target.value);
                    setConsent(false);
                  }}
                >
                  <option value="">{t("Bitte wählen")}</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("Geteilte Rechnungsversion")}
                <select
                  required
                  disabled={busy}
                  aria-label={t("Geteilte Rechnungsversion")}
                  value={revision}
                  onChange={(e) => {
                    setRevision(e.target.value);
                    setConsent(false);
                  }}
                >
                  <option value="">{t("Bitte wählen")}</option>
                  {invoices.map((i) => (
                    <option
                      key={i.currentRevisionId}
                      value={i.currentRevisionId}
                    >
                      {i.documentNumber} · {t("Version")} {i.revisionNumber}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("Gültigkeit in Stunden")}
                <input
                  type="number"
                  required
                  min={1}
                  max={24}
                  value={hours}
                  disabled={busy}
                  onChange={(e) => {
                    setHours(Number(e.target.value));
                    setConsent(false);
                  }}
                />
              </label>
              <label>
                {t("Anliegen oder Ticketreferenz")}
                <textarea
                  required
                  maxLength={500}
                  value={reason}
                  disabled={busy}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            </div>
            {cursor && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const data = await json(
                      "invoices?limit=100&cursor=" + encodeURIComponent(cursor),
                    );
                    setInvoices((current) => [
                      ...current,
                      ...data.items.filter(
                        (i: { currentRevisionId: string }) =>
                          !current.some(
                            (x) => x.currentRevisionId === i.currentRevisionId,
                          ),
                      ),
                    ]);
                    setCursor(data.nextCursor);
                  } catch {
                    setError(true);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t("Weitere Rechnungen laden")}
              </button>
            )}
            <label className="support-consent">
              <input
                type="checkbox"
                required
                checked={consent}
                disabled={busy}
                onChange={(e) => setConsent(e.target.checked)}
              />
              {t(
                "Ich erlaube dieser Supportperson den zeitlich begrenzten Zugriff auf diese Version einschließlich personenbezogener Rechnungsdaten und Prüfergebnisse.",
              )}
            </label>
            <button className="primary" disabled={busy || !consent}>
              {t("Supportzugriff erlauben")}
            </button>
          </form>
        )}
        {error && (
          <p className="error-banner" role="alert">
            {t(
              "Der Supportzugriff konnte nicht verarbeitet werden. Aktualisieren Sie die Ansicht und prüfen Sie Ihre Rechte.",
            )}
          </p>
        )}
        {notice && (
          <p role="status">
            {t(
              "Der Supportzugriff ist erteilt. Die Supportperson kann sich unter /support anmelden. Sie können den Zugriff jederzeit widerrufen.",
            )}
          </p>
        )}
        <div className="workspace-choices">
          {items.map((item) => (
            <article className="invitation-item" key={item.id}>
              <strong>
                {item.agentName} · {item.invoiceNumber}
              </strong>
              <span>
                {t("Version")} {item.revisionNumber} ·{" "}
                {t(statuses[item.status])}
              </span>
              <p>{item.reason}</p>
              <small>
                {t("Gültig bis")} {date(item.expiresAt)}
              </small>
              <small>
                {t("Zuletzt angesehen")}:{" "}
                {item.lastViewedAt
                  ? date(item.lastViewedAt)
                  : t("Noch nicht verwendet")}
              </small>
              {item.status !== "REVOKED" && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError(false);
                    try {
                      await json(`support-grants/${item.id}/revoke`, {
                        method: "POST",
                      });
                      await refresh();
                    } catch {
                      setError(true);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t("Supportzugriff widerrufen")}
                </button>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
