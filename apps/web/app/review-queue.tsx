"use client";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "./language";
import { apiErrorKeys } from "../../../packages/i18n";
export const reasonLabels: Record<string, string> = {
  TECHNICAL_RETRY: "Technische Verarbeitung",
  DATA_ERRORS: "Angaben korrigieren",
  UNSUPPORTED_CASE: "Nicht unterstützter Fall",
  RECIPIENT_REVIEW: "Empfängeranforderungen prüfen",
  VALIDATION_REQUIRED: "Prüfung erforderlich",
  APPROVAL_REQUIRED: "Freigabe erforderlich",
  GENERATION_REQUIRED: "XML erstellen",
};
const instructions: Record<string, string> = {
  TECHNICAL_RETRY:
    "Der Dienst versucht es automatisch erneut. Öffnen Sie die Rechnung, um den Verlauf zu prüfen.",
  DATA_ERRORS:
    "Öffnen Sie die Befunde und erstellen Sie bei Bedarf eine korrigierte Revision.",
  UNSUPPORTED_CASE:
    "Prüfen Sie die unterstützten Fälle. Ändern Sie keine Steuerangaben nur für ein positives Ergebnis.",
  RECIPIENT_REVIEW:
    "Prüfen Sie die Quellen und wählen Sie aktuelle, passende Empfängeranforderungen.",
  VALIDATION_REQUIRED:
    "Prüfen Sie die Vorschau und starten Sie die offizielle Prüfung.",
  APPROVAL_REQUIRED:
    "Prüfen Sie das Ergebnis und geben Sie die gültige Revision frei.",
  GENERATION_REQUIRED:
    "Erstellen Sie die geprüfte XML-Datei aus der freigegebenen Revision.",
};
export function ReviewQueue({
  onOpen,
}: {
  onOpen: (id: string, reason: string) => void;
}) {
  const { t, money, date } = useLanguage();
  const [owner, setOwner] = useState("all"),
    [reason, setReason] = useState(""),
    [page, setPage] = useState("");
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  const query = useCallback(
    () =>
      new URLSearchParams({
        owner,
        reason,
        limit: "50",
        ...(page ? { cursor: page } : {}),
      }).toString(),
    [owner, reason, page],
  );
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    fetch(`/api/v1/review-queue?${query()}`, { signal: controller.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw Error(body.error?.code || "INTERNAL_ERROR");
        setData(body);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [query, refresh]);
  async function assign(item: any, action: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/v1/review-queue/${item.invoiceId}/assignment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            expectedRevisionId: item.revisionId,
            expectedVersion: item.assignment.version,
          }),
        },
      );
      const body = await response.json();
      if (!response.ok) throw Error(body.error?.code || "INTERNAL_ERROR");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setRefresh((n) => n + 1);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">{t("PRÜFLISTE")}</div>
        <h1>{t("Gemeinsam zur fertigen Rechnung")}</h1>
        <p>
          {t(
            "Offene Schritte, klare Zuständigkeit und der direkte Weg zur Lösung.",
          )}
        </p>
      </div>
      <section className="panel review-queue">
        <div className="panel-title">
          <h2>{t("Prüfliste")}</h2>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              setPage("");
              setRefresh((n) => n + 1);
            }}
          >
            {t("Aktualisieren")}
          </button>
        </div>
        <div className="panel-body">
          <div className="review-filters">
            {[
              ["all", "Alle offenen Schritte"],
              ["mine", "Meine Rechnungen"],
              ["unassigned", "Nicht zugewiesen"],
            ].map(([value, label]) => (
              <button
                className={owner === value ? "primary" : "secondary"}
                aria-pressed={owner === value}
                disabled={busy}
                key={value}
                onClick={() => {
                  setOwner(value);
                  setPage("");
                }}
              >
                {t(label)}
                {data && ` (${data.counts[value]})`}
              </button>
            ))}
            <select
              aria-label={t("Nach Aufgabe filtern")}
              value={reason}
              disabled={busy}
              onChange={(e) => {
                setReason(e.target.value);
                setPage("");
              }}
            >
              <option value="">{t("Alle Aufgaben")}</option>
              {Object.entries(reasonLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {t(label)}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <p role="alert" className="error-banner">
              {t(apiErrorKeys[error] || error)}
            </p>
          )}
          {busy && <p role="status">{t("Prüfliste wird aktualisiert …")}</p>}
          {!busy && data?.items.length === 0 && (
            <div className="empty-state">
              <h3>{t("Hier ist alles erledigt.")}</h3>
              <p>
                {t(
                  "Keine offenen Schritte für diese Auswahl. Neue Befunde erscheinen automatisch beim Aktualisieren.",
                )}
              </p>
            </div>
          )}
          {data?.items.map((item: any) => (
            <article className="review-item" key={item.invoiceId}>
              <div className="review-item-heading">
                <div>
                  <h3>{item.documentNumber}</h3>
                  <p>{item.buyerName}</p>
                  <small>
                    {t("Revision")} {item.revisionNumber} ·{" "}
                    {date(item.createdAt)}
                  </small>
                </div>
                <strong>{money(item.payableAmount)}</strong>
              </div>
              <div className="review-reasons">
                {item.reasons.map((r: string) => (
                  <span className="badge neutral" key={r}>
                    {t(reasonLabels[r])}
                  </span>
                ))}
              </div>
              <p>{t(instructions[item.reasons[0]])}</p>
              <p>
                {item.assignment.isMine
                  ? t("Von Ihnen übernommen")
                  : item.assignment.owner
                    ? t("Übernommen von {owner}", {
                        owner: item.assignment.owner,
                      })
                    : t("Noch nicht übernommen")}
              </p>
              <div className="review-actions">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => onOpen(item.invoiceId, item.reasons[0])}
                >
                  {t("Rechnung bearbeiten")}
                </button>
                {data.canManage &&
                  (!item.assignment.owner || item.assignment.isMine) && (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        assign(
                          item,
                          item.assignment.isMine ? "RELEASE" : "CLAIM",
                        )
                      }
                    >
                      {t(item.assignment.isMine ? "Zurückgeben" : "Übernehmen")}
                    </button>
                  )}
              </div>
            </article>
          ))}
          {data && (
            <div className="review-pagination">
              <span>
                {t("{count} offene Rechnungen", { count: data.total })}
              </span>
              {page && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => setPage("")}
                >
                  {t("Zur ersten Seite")}
                </button>
              )}
              {data.nextCursor && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => setPage(data.nextCursor)}
                >
                  {t("Weitere Rechnungen")}
                </button>
              )}
            </div>
          )}
          <p className="review-note">
            {t(
              "Eine Übernahme ist keine Freigabe. Einträge verschwinden erst, wenn die zugrunde liegenden Schritte abgeschlossen sind.",
            )}
          </p>
        </div>
      </section>
    </>
  );
}
