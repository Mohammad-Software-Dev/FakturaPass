"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "./language";
import { InvoiceReview } from "./invoice-review";
import { findingDescription, apiErrorKeys } from "../../../packages/i18n";
export function CsvImport({ onOpen }: { onOpen: (id: string) => void }) {
  const { t, locale } = useLanguage();
  const [recipes, setRecipes] = useState<any[]>([]),
    [choice, setChoice] = useState(""),
    [csv, setCsv] = useState(""),
    [name, setName] = useState(""),
    [result, setResult] = useState<any>(null),
    [saved, setSaved] = useState<any>(null),
    [error, setError] = useState(""),
    [errorPosition, setErrorPosition] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState("");
  async function call(path: string, data?: unknown) {
    const response = await fetch(
      `/api/v1/${path}`,
      data
        ? {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": key,
              "Accept-Language": locale,
            },
            body: JSON.stringify(data),
          }
        : {},
    );
    const body = await response.json();
    if (!response.ok)
      throw Object.assign(
        Error(body.error?.details?.reason || body.error?.code || "CSV_FAILED"),
        { position: body.error?.details },
      );
    return body;
  }
  useEffect(() => {
    fetch("/api/v1/mapping-recipes")
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((r) => {
        setRecipes(r.items);
        if (r.items.length) setChoice("0");
      })
      .catch(() => setError("CSV_FAILED"));
  }, []);
  const input = () => ({
    csv,
    recipeId: recipes[Number(choice)]?.id,
    recipeVersion: recipes[Number(choice)]?.version,
  });
  const run = async (commit: boolean) => {
    setBusy(true);
    setError("");
    setErrorPosition(null);
    try {
      if (commit)
        setSaved(
          await call("csv/import", {
            ...input(),
            sourceSha256: result.sourceSha256,
            recipeSha256: result.recipeSha256,
          }),
        );
      else setResult(await call("csv/preview", input()));
    } catch (e) {
      setError((e as Error).message);
      setErrorPosition((e as any).position);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel csv-import">
      <div className="panel-title">
        <h2>{t("CSV-Stapel importieren")}</h2>
      </div>
      <div className="panel-body">
        <p>
          {t(
            "Eine Zeile je Position. Prüfen Sie die gruppierten Rechnungen vor dem Speichern. Es erfolgt kein Versand.",
          )}
        </p>
        <label className="editor-field">
          {t("Gespeicherte Zuordnung")}
          <select
            disabled={busy}
            value={choice}
            onChange={(e) => {
              setChoice(e.target.value);
              setResult(null);
              setSaved(null);
              setKey(crypto.randomUUID());
            }}
          >
            {recipes.map((r, n) => (
              <option key={`${r.id}/${r.version}`} value={n}>
                {r.name} · v{r.version}
              </option>
            ))}
          </select>
        </label>
        {!recipes.length && (
          <p>
            {t(
              "Keine Zuordnung eingerichtet. Eine geprüfte Exportzuordnung muss zuerst intern hinterlegt werden.",
            )}
          </p>
        )}
        <label className="upload-zone">
          <strong>{t("CSV-Datei auswählen")}</strong>
          <span>{t("UTF-8 · maximal 512 KiB · 100 Rechnungen")}</span>
          <input
            type="file"
            disabled={busy}
            accept=".csv,text/csv"
            aria-label={t("CSV-Datei auswählen")}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setResult(null);
              setSaved(null);
              setCsv("");
              setName("");
              setErrorPosition(null);
              setError("");
              if (f.size > 512 * 1024) {
                setError("CSV_TOO_LARGE");
                return;
              }
              try {
                setCsv(
                  new TextDecoder("utf-8", {
                    fatal: true,
                    ignoreBOM: true,
                  }).decode(await f.arrayBuffer()),
                );
                setName(f.name);
                setKey(crypto.randomUUID());
              } catch {
                setError("CSV_INVALID");
              }
            }}
          />
        </label>
        <p>{name}</p>
        {error && (
          <p role="alert" className="error-banner">
            {t(apiErrorKeys[error] || error)}
            {errorPosition?.row && (
              <small>
                {t("CSV-Zeilen")}: {errorPosition.row} {errorPosition.column}
              </small>
            )}
          </p>
        )}
        <button
          className="secondary"
          disabled={!csv || !recipes.length || busy}
          onClick={() => run(false)}
        >
          {busy
            ? t("Wird im Hintergrund verarbeitet …")
            : t("CSV-Vorschau prüfen")}
        </button>
        {result && (
          <>
            <p role="status">
              {t("{count} Rechnungen", { count: result.items.length })}
            </p>
            <p>
              {t(
                "Die Vorschau prüft Daten und Beträge. Die offizielle Prüfung erfolgt nach dem Import je Rechnung.",
              )}
            </p>
            {result.items.map((item: any) => (
              <details key={item.sourceId} className="csv-invoice">
                <summary>
                  {item.canonical.document?.number || item.sourceId} ·{" "}
                  {t(item.valid ? "Bereit zur Übernahme" : "Fehler gefunden")}
                </summary>
                <p>
                  {t("CSV-Zeilen")}: {item.rows.join(", ")}
                </p>
                {item.findings.map((f: any, n: number) => (
                  <p className="error-banner" key={n}>
                    {f.sourcePath || f.canonicalPath} —{" "}
                    {f.code.startsWith("CSV_")
                      ? t(f.code)
                      : findingDescription(locale, f)}
                  </p>
                ))}
                {item.valid && <InvoiceReview invoice={item.canonical} />}
              </details>
            ))}
            <button
              className="primary"
              disabled={
                busy || !!saved || result.items.some((i: any) => !i.valid)
              }
              onClick={() => run(true)}
            >
              {t("Alle Rechnungen übernehmen")}
            </button>
            <p>
              {t(
                "Fehlerhafte Stapel werden nicht gespeichert. Korrigieren Sie die Exportdatei und prüfen Sie erneut.",
              )}
            </p>
          </>
        )}
        {saved && (
          <div role="status">
            <h3>{t("Import abgeschlossen")}</h3>
            <p>
              {t(
                "Öffnen Sie eine Rechnung, um sie offiziell zu prüfen, freizugeben und als XML herunterzuladen.",
              )}
            </p>
            {saved.items.map((i: any) => (
              <p key={i.sourceId}>
                {i.sourceId} ·{" "}
                {t(i.status === "EXISTS" ? "Bereits vorhanden" : "Importiert")}{" "}
                <button
                  className="secondary"
                  onClick={() => onOpen(i.invoiceId)}
                >
                  {t("Rechnung öffnen")}
                </button>
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
