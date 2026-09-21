"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "../language";
import { AppearanceControls } from "../theme";
import { InvoiceReview } from "../invoice-review";
import type { SupportGrant } from "../support-grants";
import type { Invoice, Finding } from "../../../../packages/contracts/types";
import { findingDescription } from "../../../../packages/i18n";
type Diagnosis = {
  grant: SupportGrant;
  revision: { canonical: Invoice; sha256: string; status: string };
  validationRuns: {
    id: string;
    status: string;
    findings: Finding[];
    createdAt: string;
    engineVersion: string | null;
  }[];
};
const resultLabels: Record<string, string> = {
  PENDING: "Prüfung läuft",
  VALID: "Technisch gültig",
  INVALID: "Fehler gefunden",
  BLOCKED_UNSUPPORTED: "Nicht unterstützt",
  ERROR: "Technischer Fehler",
};
const severityLabels: Record<string, string> = {
  ERROR: "Fehler",
  WARNING: "Warnung",
  INFO: "Information",
};
export function SupportDesk() {
  const { t, locale, intlLocale } = useLanguage();
  const [items, setItems] = useState<SupportGrant[]>([]),
    [selected, setSelected] = useState(""),
    [data, setData] = useState<Diagnosis | null>(null),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/v1/support/cases", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw Error();
        const list = await response.json();
        if (!controller.signal.aborted) {
          setItems(list.items);
          setError(false);
          setSelected((current) =>
            list.items.some((g: SupportGrant) => g.id === current)
              ? current
              : "",
          );
        }
      } catch {
        if (!controller.signal.aborted) {
          setError(true);
          setItems([]);
          setSelected("");
          setData(null);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    setData(null);
    if (!selected) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    fetch("/api/v1/support/cases/" + encodeURIComponent(selected), {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw Error();
        const result: Diagnosis = await response.json();
        if (!controller.signal.aborted) {
          const remaining =
            new Date(result.grant.expiresAt).getTime() - Date.now();
          if (remaining <= 0) throw Error();
          setData(result);
          timer = setTimeout(() => {
            setData(null);
            setSelected("");
            setRefresh((n) => n + 1);
          }, remaining);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true);
          setData(null);
        }
      });
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [selected, refresh]);
  const date = (value: string) =>
    new Intl.DateTimeFormat(intlLocale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  return (
    <main className="support-desk">
      <header className="panel-title">
        <div>
          <div className="eyebrow">FakturaPass</div>
          <h1>{t("Supportfälle")}</h1>
        </div>
        <AppearanceControls />
        <form action="/api/v1/auth/logout" method="post">
          <button className="secondary">{t("Von FakturaPass abmelden")}</button>
        </form>
      </header>
      <p>
        {t(
          "Nur ausdrücklich geteilte Rechnungsversionen sind sichtbar. Änderungen, Freigaben und Dateidownloads sind gesperrt.",
        )}
      </p>
      <button
        className="secondary"
        onClick={() => {
          setData(null);
          setRefresh((n) => n + 1);
        }}
      >
        {t("Aktualisieren")}
      </button>
      {loading && <p role="status">{t("Supportfälle werden geladen …")}</p>}
      {error && (
        <p className="error-banner" role="alert">
          {t(
            "Dieser Supportzugriff ist nicht mehr verfügbar. Die Ansicht wurde geschlossen.",
          )}
        </p>
      )}
      {!loading && !items.length && (
        <p role="status">{t("Derzeit sind keine Supportfälle freigegeben.")}</p>
      )}
      <nav className="workspace-choices" aria-label={t("Supportfälle")}>
        {items.map((item) => (
          <button
            className="secondary support-case"
            key={item.id}
            aria-pressed={selected === item.id}
            onClick={() => {
              setData(null);
              setError(false);
              setSelected(item.id);
            }}
          >
            <strong>
              {item.workspaceName} · {item.invoiceNumber}
            </strong>
            <span>
              {t("Version")} {item.revisionNumber} · {t("Gültig bis")}{" "}
              {date(item.expiresAt)}
            </span>
            <span>{item.reason}</span>
          </button>
        ))}
      </nav>
      {data && selected === data.grant.id && (
        <section className="panel">
          <div className="panel-title">
            <h2>
              {data.grant.invoiceNumber} · {t("Version")}{" "}
              {data.grant.revisionNumber}
            </h2>
            <button
              className="secondary"
              onClick={() => {
                setSelected("");
                setData(null);
              }}
            >
              {t("Ansicht schließen")}
            </button>
          </div>
          <div className="panel-body">
            <p>
              {t("Nur lesen")} · {t("Gültig bis")} {date(data.grant.expiresAt)}
            </p>
            <InvoiceReview invoice={data.revision.canonical} />
            <h3>{t("Gespeicherte Prüfergebnisse")}</h3>
            {!data.validationRuns.length && (
              <p>
                {t("Für diese Version liegen noch keine Prüfergebnisse vor.")}
              </p>
            )}
            {data.validationRuns.map((run) => (
              <article className="invitation-item" key={run.id}>
                <strong>{t(resultLabels[run.status] ?? run.status)}</strong>
                <small>
                  {date(run.createdAt)} · {run.engineVersion}
                </small>
                {run.findings.map((finding, i) => (
                  <div key={i} className="support-finding">
                    <p>
                      <strong>{finding.code}</strong> ·{" "}
                      {t(severityLabels[finding.severity])} ·{" "}
                      {findingDescription(locale, finding)}
                    </p>
                    <p>
                      {t("Betroffenes Feld:")} {finding.canonicalPath}
                    </p>
                    {finding.ruleId && (
                      <p>
                        {t("Regel:")} {finding.ruleId}
                      </p>
                    )}
                    <details>
                      <summary>{t("Technische Details")}</summary>
                      <pre>{JSON.stringify(finding.parameters, null, 2)}</pre>
                    </details>
                  </div>
                ))}
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
