"use client";
import { AppearanceControls } from "./theme";
import { useLanguage } from "./language";
import {
  apiErrorKeys,
  findingTitles,
  findingDescription,
} from "../../../packages/i18n";
import { schemaFindings } from "../../../packages/contracts/validate";
import { useEffect, useState, useCallback } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  Download,
  FileCheck2,
  FileJson,
  FileText,
  FolderOpen,
  History,
  Info,
  LayoutDashboard,
  LoaderCircle,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Upload,
  UploadCloud,
  X,
  AlertCircle,
  CheckCircle2,
  Code2,
  Copy,
  RefreshCw,
} from "lucide-react";
import type { Finding } from "../../../packages/contracts/types";
type Fixture = { name: string; code: string; data: any };
const statusNames: Record<string, string> = {
  NORMALIZED: "Aufbereitet",
  VALIDATION_PENDING: "Prüfung läuft",
  VALID: "Technisch gültig",
  INVALID: "Fehler gefunden",
  BLOCKED_UNSUPPORTED: "Nicht unterstützt",
  APPROVED: "Freigegeben",
  GENERATION_PENDING: "Erstellung läuft",
  GENERATED: "Erstellt",
  ARTIFACT_VALIDATED: "Offizielle Prüfung bestanden",
};
function Badge({ status }: { status: string }) {
  const { t } = useLanguage();
  return (
    <span
      className={`badge ${["VALID", "ARTIFACT_VALIDATED", "APPROVED", "PASS"].includes(status) ? "success" : ["INVALID", "BLOCKED_UNSUPPORTED", "FAIL"].includes(status) ? "red" : status?.includes("PENDING") ? "blue" : "neutral"}`}
    >
      <span className="dot" />
      {t(
        statusNames[status] ??
          {
            PASS: "Bestanden",
            FAIL: "Fehlgeschlagen",
            PENDING: "Prüfung läuft",
            ERROR: "Technischer Fehler",
          }[status] ??
          "Ausstehend",
      )}
    </span>
  );
}
async function api(path: string, body?: unknown, key?: string, raw?: string) {
  const response = await fetch(
    `/api/v1/${path}`,
    body === undefined
      ? { headers: { "Accept-Language": document.documentElement.lang } }
      : {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept-Language": document.documentElement.lang,
            ...(key ? { "Idempotency-Key": key } : {}),
          },
          body: raw ?? JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(data.error?.code ?? "Verbindung fehlgeschlagen"),
      {
        code: data.error?.code,
        details: data.error?.details,
        requestId: data.error?.requestId,
      },
    );
  return data;
}
export default function Workspace({ fixtures }: { fixtures: Fixture[] }) {
  const { t, locale, intlLocale, money, date, decimal } = useLanguage();
  const [view, setView] = useState("invoices"),
    [items, setItems] = useState<any[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<any>(null),
    [tab, setTab] = useState("overview"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [validationFilter, setValidationFilter] = useState(""),
    [text, setText] = useState(""),
    [preview, setPreview] = useState<any>(null),
    [profile, setProfile] = useState<string>(""),
    [correcting, setCorrecting] = useState(false),
    [toast, setToast] = useState(""),
    [importKey, setImportKey] = useState(""),
    [health, setHealth] = useState(false);
  const load = useCallback(async () => {
    let cursor: string | null = null;
    const all: any[] = [];
    do {
      const data = await api(
        `invoices?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      );
      all.push(...data.items);
      cursor = data.nextCursor;
    } while (cursor);
    setItems(all);
  }, []);
  useEffect(() => {
    load()
      .catch(setError)
      .finally(() => setLoading(false));
    fetch("/api/v1/health/ready")
      .then((r) => setHealth(r.ok))
      .catch(() => setHealth(false));
  }, [load]);
  const open = async (id: string) => {
    setError(null);
    setBusy(true);
    try {
      const data = await api(`invoices/${id}`);
      setSelected(data);
      setProfile(
        data.currentRevision.validationRuns.find(
          (r: any) => r.kind === "PRECHECK",
        )?.recipientProfileVersionId ?? "",
      );
      setView("detail");
      setTab("overview");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const refresh = async () => {
    await load();
    if (selected) {
      const data = await api(`invoices/${selected.invoiceId}`);
      setSelected(data);
    }
  };
  useEffect(() => {
    if (
      !selected ||
      !["VALIDATION_PENDING", "GENERATION_PENDING"].includes(
        selected.currentRevision.status,
      )
    )
      return;
    const timer = setInterval(() => {
      api(`invoices/${selected.invoiceId}`).then(setSelected).catch(setError);
      load().catch(() => {});
    }, 1200);
    return () => clearInterval(timer);
  }, [selected, load]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  const go = (v: string) => {
    setView(v);
    setError(null);
    if (v === "import") {
      setText("");
      setPreview(null);
      setImportKey(crypto.randomUUID());
      setCorrecting(false);
    }
  };
  const parse = () => {
    setError(null);
    try {
      if (new TextEncoder().encode(text).length > 1024 * 1024)
        throw Error("Die Datei darf höchstens 1 MiB groß sein.");
      const p = JSON.parse(text);
      const findings = schemaFindings(p);
      if (findings.length)
        throw Object.assign(
          new Error(
            "Die Datei entspricht nicht dem Rechnungsformat. Bitte prüfen Sie die markierten Felder.",
          ),
          { details: { findings } },
        );
      setPreview(p);
    } catch (e) {
      setError(e);
      setPreview(null);
    }
  };
  const importInvoice = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = correcting
        ? await api(`invoices/${selected.invoiceId}/revisions`, {
            priorRevisionId: selected.currentRevision.revisionId,
            canonical: preview,
          })
        : await api("invoices", preview, importKey, text);
      await load();
      await open(result.invoiceId ?? selected.invoiceId);
      setCorrecting(false);
      setToast("Rechnung erfolgreich gespeichert.");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const perform = async (action: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = selected.currentRevision;
      const run = r.validationRuns.find((v: any) => v.kind === "PRECHECK");
      const body =
        action === "validate"
          ? { recipientProfileVersionId: profile || null }
          : action === "approve"
            ? {
                validationRunId: run?.validationRunId,
                recipientProfileVersionId:
                  run?.recipientProfileVersionId ?? null,
              }
            : {};
      await api(
        `invoices/${selected.invoiceId}/revisions/${r.revisionId}/${action}`,
        body,
      );
      await refresh();
      setToast(
        action === "approve" ? "Revision freigegeben." : "Auftrag gestartet.",
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const [focusPath, setFocusPath] = useState("");
  const r = selected?.currentRevision;
  const historical = r && selected.revisions[0]?.revisionId !== r.revisionId;
  const invoice = r?.canonical;
  const findings: Finding[] = r?.validationRuns[0]?.findings ?? [];
  const filtered = items.filter(
    (i) =>
      (!filter || i.status === filter) &&
      (!validationFilter || i.validationResult === validationFilter) &&
      `${i.documentNumber} ${i.buyerName} ${i.sourceRecordId}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const valid = items.filter((i) => i.status === "ARTIFACT_VALIDATED").length;
  const failed = items.filter((i) =>
    ["INVALID", "BLOCKED_UNSUPPORTED"].includes(i.status),
  ).length;
  const errorView = error && (
    <div className="error-banner" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>
          {t(
            apiErrorKeys[error.code] ??
              (error instanceof SyntaxError
                ? "Ungültiges JSON. Bitte prüfen Sie die Syntax."
                : error instanceof TypeError
                  ? "Verbindung fehlgeschlagen"
                  : (error.message ?? "Ein Fehler ist aufgetreten.")),
          )}
        </strong>
        {error.details?.findings?.map((f: Finding, n: number) => (
          <p key={n}>
            <code>{f.canonicalPath}</code> — {findingDescription(locale, f)}
          </p>
        ))}
        {error.requestId && (
          <small>
            {t("Anfrage-ID:")} {error.requestId}
          </small>
        )}
      </div>
      <button
        className="icon-button"
        onClick={() => setError(null)}
        aria-label={t("Fehlermeldung schließen")}
      >
        <X size={17} />
      </button>
    </div>
  );
  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label={t("FakturaPass Startseite")}>
          <span className="brand-icon">
            <CheckCheck size={23} />
          </span>
          Faktura<span>Pass</span>
        </a>
        <div className="nav-label">{t("ARBEITSPLATZ")}</div>
        <nav>
          <button
            className={view === "invoices" || view === "detail" ? "active" : ""}
            onClick={() => go("invoices")}
          >
            <LayoutDashboard size={19} />
            {t("Rechnungen")}
            <span className="nav-count">{items.length}</span>
          </button>
          <button
            className={view === "import" ? "active" : ""}
            onClick={() => go("import")}
          >
            <Upload size={19} />
            {t("Importieren")}{" "}
          </button>
          <button
            className={view === "settings" ? "active" : ""}
            onClick={() => go("settings")}
          >
            <Settings2 size={19} />
            {t("Einstellungen & Info")}{" "}
          </button>
        </nav>
        <div className="sidebar-bottom">
          <p className="sidebar-assurance">
            <ShieldCheck size={17} />
            {t("Jeder Stand bleibt erhalten.")}
          </p>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            {t("Arbeitsbereich")} <ChevronRight size={14} />{" "}
            <strong>
              {view === "detail"
                ? t("Rechnungsdetails")
                : view === "import"
                  ? t("Importieren")
                  : view === "settings"
                    ? t("Einstellungen & Info")
                    : t("Rechnungen")}
            </strong>
          </div>
          <AppearanceControls />
        </header>
        <main>
          {view === "invoices" && (
            <>
              <div className="page-heading">
                <div className="eyebrow">{t("RECHNUNGSARBEITSPLATZ")}</div>
                <div className="heading-row">
                  <div>
                    <h1>{t("Jede Rechnung. Nachvollziehbar.")}</h1>
                    <p>
                      {t("Prüfen, freigeben und als XRechnung exportieren.")}
                    </p>
                  </div>
                  {items.length > 0 && (
                    <button className="primary" onClick={() => go("import")}>
                      <Plus size={18} />
                      {t("Rechnung importieren")}{" "}
                    </button>
                  )}
                </div>
              </div>
              {errorView}
              <div className="stats">
                <div className="stat">
                  <span>
                    {t("Rechnungen gesamt")} <FileText size={18} />
                  </span>
                  <strong>{items.length.toString().padStart(2, "0")}</strong>
                  <small>{t("Im lokalen Arbeitsbereich")}</small>
                </div>
                <div className="stat">
                  <span>
                    {t("Offizielle Prüfung bestanden")}{" "}
                    <ShieldCheck size={18} />
                  </span>
                  <strong>
                    {valid.toString().padStart(2, "0")}
                    <span className="stat-chip">XRechnung</span>
                  </strong>
                  <small>{t("Mit geprüftem XML-Artefakt")}</small>
                </div>
                <div className="stat">
                  <span>
                    {t("Zu prüfen")} <AlertCircle size={18} />
                  </span>
                  <strong>{failed.toString().padStart(2, "0")}</strong>
                  <small>{t("Angaben oder Steuerfall prüfen")}</small>
                </div>
              </div>
              <section className="panel invoice-panel">
                <div className="panel-title">
                  <div>
                    <h2>
                      {t("Alle Rechnungen")} <span>{items.length}</span>
                    </h2>
                    <p>{t("Von der Quelldatei bis zum geprüften Artefakt.")}</p>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => load().catch(setError)}
                    aria-label={t("Rechnungen aktualisieren")}
                  >
                    <RefreshCw size={17} />
                  </button>
                </div>
                <div className="table-toolbar">
                  <div className="search">
                    <Search size={17} />
                    <input
                      aria-label={t("Rechnungen suchen")}
                      placeholder={t(
                        "Rechnungsnummer, Empfänger oder Quell-ID suchen …",
                      )}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <select
                    aria-label={t("Status filtern")}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="">{t("Alle Status")}</option>
                    {Object.entries(statusNames).map(([v, label]) => (
                      <option key={v} value={v}>
                        {t(label)}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={t("Prüfergebnis filtern")}
                    value={validationFilter}
                    onChange={(e) => setValidationFilter(e.target.value)}
                  >
                    <option value="">{t("Alle Prüfergebnisse")}</option>
                    <option value="PASS">{t("Bestanden")}</option>
                    <option value="FAIL">{t("Fehlgeschlagen")}</option>
                    <option value="PENDING">{t("Prüfung läuft")}</option>
                  </select>
                </div>
                {loading ? (
                  <div className="empty">
                    <LoaderCircle className="spin" />
                    <h3>{t("Rechnungen werden geladen …")}</h3>
                  </div>
                ) : !items.length ? (
                  <div className="empty">
                    <div className="empty-icon">
                      <FileCheck2 size={34} />
                    </div>
                    <h3>{t("Bereit für Ihre erste Rechnung.")}</h3>
                    <p>
                      {t(
                        "Importieren Sie eine mitgelieferte Demo-Rechnung und",
                      )}{" "}
                      <br />
                      {t(
                        "durchlaufen Sie die vollständige XRechnung-Prüfung.",
                      )}{" "}
                    </p>
                    <button className="primary" onClick={() => go("import")}>
                      <Plus size={16} />
                      {t("Demo-Rechnung importieren")}{" "}
                    </button>
                    <small>{t("Canonical JSON · Maximal 1 MiB")}</small>
                  </div>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("Rechnung / Empfänger")}</th>
                          <th>{t("Datum")}</th>
                          <th>{t("Betrag")}</th>
                          <th>{t("Status")}</th>
                          <th>{t("Standard / Empfänger")}</th>
                          <th>{t("Stand")}</th>
                          <th>
                            <span className="sr-only">{t("Öffnen")}</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((i) => (
                          <tr key={i.invoiceId}>
                            <td>
                              <button
                                className="invoice-link"
                                onClick={() => open(i.invoiceId)}
                              >
                                <span className="file-icon">
                                  <FileText size={19} />
                                </span>
                                <span>
                                  <strong>{i.documentNumber}</strong>
                                  <small>{i.buyerName}</small>
                                </span>
                              </button>
                            </td>
                            <td>{date(i.issueDate)}</td>
                            <td className="amount">
                              {money(i.payableAmount)}
                              <small>EUR</small>
                            </td>
                            <td>
                              <Badge status={i.status} />
                            </td>
                            <td>
                              <span className="standard-result">
                                {i.standardResult === "PASS" ? (
                                  <CheckCircle2 size={14} />
                                ) : (
                                  <span className="dot" />
                                )}
                                {i.standardResult === "PASS"
                                  ? t("Bestanden")
                                  : i.standardResult === "FAIL"
                                    ? t("Fehler")
                                    : t("Ausstehend")}
                              </span>
                              <small>
                                {i.recipientCoverage === "SYNTHETIC"
                                  ? t("Demo · nicht verifiziert")
                                  : t("Empfänger unbekannt")}
                              </small>
                            </td>
                            <td>
                              <strong className="revision-label">
                                {t("Rev.")} {i.revisionNumber}
                              </strong>
                              <small>{date(i.updatedAt)}</small>
                            </td>
                            <td>
                              <button
                                className="icon-button"
                                aria-label={t("Rechnung {number} öffnen", {
                                  number: i.documentNumber,
                                })}
                                onClick={() => open(i.invoiceId)}
                              >
                                <ArrowUpRight size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!filtered.length && (
                      <div className="empty compact">
                        <Search />
                        <h3>{t("Keine passenden Rechnungen.")}</h3>
                        <button
                          className="secondary"
                          onClick={() => {
                            setSearch("");
                            setFilter("");
                            setValidationFilter("");
                          }}
                        >
                          {t("Filter zurücksetzen")}{" "}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className="table-footer">
                  <span>
                    {t(
                      filtered.length === 1
                        ? "{count} Rechnung"
                        : "{count} Rechnungen",
                      { count: filtered.length },
                    )}
                  </span>
                  <span>
                    <ShieldCheck size={14} />
                    {t("Unveränderliche Revisionen · SHA-256-Nachweise")}{" "}
                  </span>
                </div>
              </section>
            </>
          )}
          {view === "import" && (
            <>
              <button className="back" onClick={() => go("invoices")}>
                <ArrowLeft size={16} />
                {t("Zurück zu Rechnungen")}{" "}
              </button>
              <div className="page-heading">
                <div className="eyebrow">
                  {correcting ? t("NEUE REVISION") : t("DATENIMPORT")}
                </div>
                <h1>
                  {correcting
                    ? t("Korrigierte Revision erstellen")
                    : t("Der erste Schritt zur XRechnung.")}
                </h1>
                <p>
                  {correcting
                    ? t("Die bisherige Revision bleibt unverändert erhalten.")
                    : t(
                        "Canonical JSON importieren, Vorschau prüfen und sicher übernehmen.",
                      )}
                </p>
              </div>
              {errorView}
              <div className="import-grid">
                <section className="panel">
                  <div className="panel-title">
                    <h2>
                      <span className="step">1</span>
                      {t("Quelldaten auswählen")}{" "}
                    </h2>
                    <span className="muted">{t("JSON · Max. 1 MiB")}</span>
                  </div>
                  <div className="panel-body">
                    {!correcting && (
                      <>
                        <label className="upload-zone">
                          <UploadCloud size={32} />
                          <strong>{t("JSON-Datei auswählen")}</strong>
                          <span>
                            {t("oder unten eine Demo-Vorlage verwenden")}
                          </span>
                          <input
                            type="file"
                            accept=".json,application/json"
                            aria-label={t("JSON-Datei auswählen")}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 1024 * 1024) {
                                setError(
                                  Error(
                                    "Die Datei darf höchstens 1 MiB groß sein.",
                                  ),
                                );
                                return;
                              }
                              setText(await file.text());
                              setPreview(null);
                              setError(null);
                            }}
                          />
                        </label>
                        <details className="format-help">
                          <summary>{t("Formatbeispiel ansehen")}</summary>
                          <label className="field-label" htmlFor="fixture">
                            {t("Rechnungsvorlage")}
                          </label>
                          <select
                            id="fixture"
                            defaultValue=""
                            onChange={(event) => {
                              const example =
                                fixtures[Number(event.target.value)];
                              if (example) {
                                setText(JSON.stringify(example.data, null, 2));
                                setPreview(null);
                                setError(null);
                              }
                            }}
                          >
                            <option value="" disabled>
                              {t("Vorlage auswählen …")}
                            </option>
                            {fixtures.map((example, index) => (
                              <option value={index} key={example.code}>
                                {t(example.name)}
                              </option>
                            ))}
                          </select>
                          <p>
                            {t(
                              "Die Vorlage enthält fiktive Angaben. Ersetzen Sie diese vor dem Import.",
                            )}
                          </p>
                        </details>
                        <div className="or-label">
                          {t("ODER JSON EINFÜGEN")}
                        </div>
                      </>
                    )}
                    <label className="field-label" htmlFor="canonical">
                      {t("Canonical JSON")}{" "}
                    </label>
                    <textarea
                      id="canonical"
                      className="code-editor"
                      spellCheck={false}
                      value={text}
                      placeholder={
                        '{\n  "schemaVersion": "fakturapass.invoice.v1",\n  ...\n}'
                      }
                      onChange={(e) => {
                        setText(e.target.value);
                        setPreview(null);
                      }}
                    />
                    <div className="actions">
                      <button
                        className="secondary"
                        disabled={!text || busy}
                        onClick={parse}
                      >
                        {t("Vorschau prüfen")} <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                </section>
                <section className="panel preview-panel">
                  <div className="panel-title">
                    <h2>
                      <span className="step">2</span>
                      {t("Importvorschau")}{" "}
                    </h2>
                  </div>
                  {preview ? (
                    <div className="panel-body">
                      <span className="badge blue">
                        <FileJson size={13} />
                        {t("JSON gelesen")}{" "}
                      </span>
                      <h2 className="preview-number">
                        {preview.document?.number ?? t("Rechnungsnummer fehlt")}
                      </h2>
                      <p>{preview.buyer?.name ?? t("Empfänger fehlt")}</p>
                      <div className="preview-amount">
                        {typeof preview.totals?.payableAmount === "string"
                          ? money(preview.totals.payableAmount)
                          : t("Betrag fehlt")}
                      </div>
                      <dl>
                        <div>
                          <dt>{t("Quelle")}</dt>
                          <dd>{preview.source?.system ?? "—"}</dd>
                        </div>
                        <div>
                          <dt>{t("Quell-ID")}</dt>
                          <dd>{preview.source?.recordId ?? "—"}</dd>
                        </div>
                        <div>
                          <dt>{t("Rechnungsdatum")}</dt>
                          <dd>
                            {preview.document?.issueDate
                              ? date(preview.document.issueDate)
                              : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt>{t("Positionen")}</dt>
                          <dd>{preview.lines?.length ?? 0}</dd>
                        </div>
                      </dl>
                      <div className="notice">
                        <Info size={18} />
                        <p>
                          {t(
                            "Die Vorschau ersetzt keine Prüfung. Schema, Beträge und offizielle Regeln werden gesondert geprüft.",
                          )}{" "}
                        </p>
                      </div>
                      <button
                        className="primary full"
                        disabled={busy}
                        onClick={importInvoice}
                      >
                        {busy ? (
                          <LoaderCircle className="spin" size={17} />
                        ) : (
                          <Check size={17} />
                        )}{" "}
                        {correcting
                          ? t("Neue Revision speichern")
                          : t("Rechnung importieren")}
                      </button>
                    </div>
                  ) : (
                    <div className="empty compact">
                      <FolderOpen size={38} />
                      <h3>{t("Zuerst die Quelle auswählen.")}</h3>
                      <p>
                        {t("Hier sehen Sie die Rechnungsdaten,")} <br />
                        {t("bevor Sie den Import bestätigen.")}{" "}
                      </p>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
          {view === "detail" && invoice && (
            <>
              <button className="back" onClick={() => go("invoices")}>
                <ArrowLeft size={16} />
                {t("Alle Rechnungen")}{" "}
              </button>
              <div className="detail-heading">
                <div>
                  <div className="eyebrow">
                    {t("RECHNUNG ·")} {invoice.source.system}
                  </div>
                  <h1>{invoice.document.number}</h1>
                  <p>
                    {invoice.buyer.name}
                    <span className="separator">·</span>
                    {date(invoice.document.issueDate)}
                    <span className="separator">·</span>
                    {t("Revision")} {r.revisionNumber}
                  </p>
                </div>
                <div className="detail-amount">
                  {money(invoice.totals.payableAmount)}
                  <small>{t("Rechnungsbetrag inkl. USt.")}</small>
                </div>
              </div>
              {errorView}
              <div className="workflow-bar">
                <Badge status={r.status} />
                <div className="workflow-actions">
                  {historical ? (
                    <button
                      className="secondary"
                      onClick={() => open(selected.invoiceId)}
                    >
                      {t("Aktuelle Revision öffnen")}{" "}
                    </button>
                  ) : (
                    <>
                      {[
                        "NORMALIZED",
                        "INVALID",
                        "BLOCKED_UNSUPPORTED",
                        "VALID",
                      ].includes(r.status) && (
                        <>
                          <select
                            aria-label={t("Empfängerprofil")}
                            value={profile}
                            onChange={(e) => setProfile(e.target.value)}
                          >
                            <option value="">{t("Empfänger unbekannt")}</option>
                            <option value="synthetic-reference-v1">
                              {t("Demo · Käuferreferenz")}{" "}
                            </option>
                            <option value="synthetic-po-v1">
                              {t("Demo · Bestellbezug")}{" "}
                            </option>
                            <option value="synthetic-contract-v1">
                              {t("Demo · Vertragsbezug")}{" "}
                            </option>
                          </select>
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() => perform("validate")}
                          >
                            <ShieldCheck size={16} />
                            {t("Prüfen")}{" "}
                          </button>
                        </>
                      )}
                      {r.status === "VALID" && (
                        <button
                          className="primary"
                          disabled={
                            busy ||
                            (profile || null) !==
                              (r.validationRuns.find(
                                (v: any) => v.kind === "PRECHECK",
                              )?.recipientProfileVersionId ?? null)
                          }
                          onClick={() => perform("approve")}
                        >
                          <Check size={17} />
                          {t("Revision freigeben")}{" "}
                        </button>
                      )}
                      {r.status === "APPROVED" && (
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() => perform("generate")}
                        >
                          <FileCheck2 size={17} />
                          {t("XRechnung erstellen")}{" "}
                        </button>
                      )}
                      {r.status === "ARTIFACT_VALIDATED" && r.artifacts[0] && (
                        <a
                          className="primary"
                          href={`/api/v1/artifacts/${r.artifacts[0].artifactId}/download`}
                        >
                          <Download size={17} />
                          {t("XML herunterladen")}{" "}
                        </a>
                      )}
                      {r.status.includes("PENDING") && (
                        <span className="processing" role="status">
                          <LoaderCircle className="spin" size={17} />
                          {t("Wird im Hintergrund verarbeitet …")}{" "}
                        </span>
                      )}
                      <button
                        className="secondary"
                        onClick={() => {
                          setText(JSON.stringify(invoice, null, 2));
                          setPreview(null);
                          setCorrecting(true);
                          setView("import");
                        }}
                      >
                        {t("Korrigierte Revision")}{" "}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="progress-track">
                {[
                  t("Importiert"),
                  t("Geprüft"),
                  t("Freigegeben"),
                  t("XRechnung erstellt"),
                ].map((step, n) => {
                  const stage =
                    r.status === "ARTIFACT_VALIDATED"
                      ? 4
                      : r.status === "APPROVED" ||
                          r.status === "GENERATION_PENDING"
                        ? 3
                        : r.status === "VALID"
                          ? 2
                          : 1;
                  return (
                    <div className={n < stage ? "done" : ""} key={step}>
                      <span>{n < stage ? <Check size={13} /> : n + 1}</span>
                      {step}
                      {n < 3 && <div className="track-line" />}
                    </div>
                  );
                })}
              </div>
              <div
                className="tabs"
                role="tablist"
                aria-label={t("Rechnungsansichten")}
              >
                {[
                  ["overview", t("Übersicht"), FileText],
                  [
                    "findings",
                    `${t("Prüfergebnisse")}${findings.length ? ` (${findings.length})` : ""}`,
                    ShieldCheck,
                  ],
                  ["source", t("Quelle & Daten"), Code2],
                  ["artifacts", t("Artefakte & Nachweise"), FolderOpen],
                  ["history", t("Verlauf"), History],
                ].map(([key, label, Icon]) => {
                  const I = Icon as typeof FileText;
                  return (
                    <button
                      role="tab"
                      aria-selected={tab === key}
                      key={String(key)}
                      className={tab === key ? "active" : ""}
                      onClick={() => setTab(String(key))}
                    >
                      <I size={17} />
                      {String(label)}
                    </button>
                  );
                })}
              </div>
              {tab === "overview" && (
                <div className="detail-grid">
                  <div>
                    <section className="panel">
                      <div className="panel-title">
                        <h2>{t("Rechnungsübersicht")}</h2>
                        <span className="muted">{t("Originalangaben")}</span>
                      </div>
                      <div className="parties">
                        {[
                          [t("Rechnungssteller"), invoice.seller],
                          [t("Rechnungsempfänger"), invoice.buyer],
                        ].map(([label, p]: any) => (
                          <div key={label}>
                            <span className="eyebrow">{label}</span>
                            <h3>{p.name}</h3>
                            <p>
                              {p.address.street}
                              <br />
                              {p.address.postalCode} {p.address.city}
                              <br />
                              {t("Deutschland")}{" "}
                            </p>
                            <small>
                              {t("USt-ID:")} {p.vatId ?? t("Nicht angegeben")}
                            </small>
                          </div>
                        ))}
                      </div>
                      <div className="references">
                        <div>
                          <small>{t("Käuferreferenz")}</small>
                          <strong>
                            {invoice.document.buyerReference ??
                              t("Nicht angegeben")}
                          </strong>
                        </div>
                        <div>
                          <small>{t("Bestellnummer")}</small>
                          <strong>
                            {invoice.document.purchaseOrderReference ??
                              t("Nicht angegeben")}
                          </strong>
                        </div>
                        <div>
                          <small>{t("Fällig am")}</small>
                          <strong>
                            {invoice.payment?.dueDate
                              ? date(invoice.payment.dueDate)
                              : t("Nicht angegeben")}
                          </strong>
                        </div>
                      </div>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>{t("Position / Beschreibung")}</th>
                              <th>{t("Menge")}</th>
                              <th>{t("Einzelpreis")}</th>
                              <th>{t("Netto")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoice.lines.map((l: any) => (
                              <tr key={l.id}>
                                <td>
                                  <strong>{l.name}</strong>
                                  <small>
                                    {t("Pos.")} {l.id}
                                    {t("· USt.")} {decimal(l.tax.rate)} %
                                  </small>
                                </td>
                                <td>
                                  {decimal(l.quantity)} {l.unitCode}
                                </td>
                                <td>{money(l.unitPrice.amount)}</td>
                                <td className="amount">
                                  {money(l.lineNetAmount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="totals">
                        <div>
                          <span>{t("Nettobetrag")}</span>
                          <strong>
                            {money(invoice.totals.taxExclusiveAmount)}
                          </strong>
                        </div>
                        <div>
                          <span>{t("Umsatzsteuer")}</span>
                          <strong>{money(invoice.totals.taxAmount)}</strong>
                        </div>
                        <div className="total">
                          <span>{t("Zahlbetrag")}</span>
                          <strong>{money(invoice.totals.payableAmount)}</strong>
                        </div>
                      </div>
                    </section>
                  </div>
                  <div>
                    <section className="panel validation-card">
                      <div className="panel-title">
                        <h2>{t("Prüfstatus")}</h2>
                        <ShieldCheck size={19} />
                      </div>
                      <div className="panel-body">
                        <div className="check-block">
                          <span className="check-icon">
                            <FileCheck2 size={20} />
                          </span>
                          <div>
                            <h3>XRechnung 3.0.2</h3>
                            <p>
                              {r.validationRuns[0]?.status === "PASS"
                                ? t("Offizielle Prüfung bestanden")
                                : r.validationRuns[0]?.status === "FAIL"
                                  ? r.validationRuns[0]?.xmlSha256
                                    ? t("Prüfung mit Fehlern")
                                    : t("Noch nicht ausgeführt")
                                  : r.validationRuns[0]?.status === "ERROR"
                                    ? t("Prüfdienst nicht erreichbar")
                                    : t("Noch nicht abgeschlossen")}
                            </p>
                            <small>KoSIT Validator 1.6.3</small>
                          </div>
                        </div>
                        <div className="check-block">
                          <span className="check-icon unknown">
                            <Info size={20} />
                          </span>
                          <div>
                            <h3>{t("Empfängeranforderungen")}</h3>
                            <p>
                              {r.validationRuns[0]?.recipientProfileVersionId
                                ? t("Demo-Profil · nicht verifiziert")
                                : t("Unbekannt")}
                            </p>
                            <small>
                              {t("Keine Aussage zur Empfängerannahme")}
                            </small>
                          </div>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => setTab("findings")}
                        >
                          {t("Alle Prüfergebnisse")} <ArrowRight size={16} />
                        </button>
                      </div>
                    </section>
                    <section className="trace-note">
                      <ShieldCheck size={24} />
                      <h3>{t("Jeder Stand bleibt erhalten.")}</h3>
                      <p>
                        {t(
                          "Quelldaten, Revisionen und Artefakte sind unveränderlich gespeichert und durch SHA-256-Prüfsummen verknüpft.",
                        )}{" "}
                      </p>
                      <button
                        className="text-button"
                        onClick={() => setTab("source")}
                      >
                        {t("Nachweise ansehen")} <ArrowUpRight size={15} />
                      </button>
                    </section>
                  </div>
                </div>
              )}
              {tab === "findings" && (
                <section className="panel">
                  <div className="panel-title">
                    <div>
                      <h2>{t("Prüfergebnisse")}</h2>
                      <p>
                        {t(
                          "Technische Regeln und Empfängeranforderungen werden getrennt bewertet.",
                        )}{" "}
                      </p>
                    </div>
                    {r.validationRuns[0] && (
                      <Badge status={r.validationRuns[0].status} />
                    )}
                  </div>
                  <div className="panel-body">
                    {!r.validationRuns.length ? (
                      <div className="empty compact">
                        <ShieldCheck size={35} />
                        <h3>{t("Noch keine Prüfung ausgeführt.")}</h3>
                        <p>
                          {t("Starten Sie oben die Prüfung dieser Revision.")}
                        </p>
                      </div>
                    ) : (
                      ["STANDARD", "SEMANTIC", "RECIPIENT", "SYSTEM"].map(
                        (layer) => (
                          <div className="finding-group" key={layer}>
                            <h3>
                              {
                                (
                                  {
                                    STANDARD: t("Offizielle Standards"),
                                    SEMANTIC: t("Datenkonsistenz"),
                                    RECIPIENT: t("Empfängeranforderungen"),
                                    SYSTEM: t("System"),
                                  } as any
                                )[layer]
                              }
                            </h3>
                            {findings
                              .filter((f) => f.layer === layer)
                              .sort(
                                (a, b) =>
                                  ["ERROR", "WARNING", "INFO"].indexOf(
                                    a.severity,
                                  ) -
                                  ["ERROR", "WARNING", "INFO"].indexOf(
                                    b.severity,
                                  ),
                              )
                              .map((f, n) => (
                                <div
                                  className={`finding ${f.severity.toLowerCase()}`}
                                  key={n}
                                >
                                  <AlertCircle size={19} />
                                  <div>
                                    <strong>
                                      {t(
                                        findingTitles[f.code] ??
                                          "Bitte prüfen Sie die betroffene Angabe.",
                                      )}
                                    </strong>
                                    <p>{findingDescription(locale, f)}</p>
                                    {f.canonicalPath && (
                                      <button
                                        className="field-link"
                                        onClick={() => {
                                          setTab("source");
                                          setFocusPath(f.canonicalPath);
                                        }}
                                      >
                                        {f.canonicalPath}
                                        <ArrowUpRight size={12} />
                                      </button>
                                    )}
                                    {f.parameters.declared != null && (
                                      <div className="compare">
                                        <span>
                                          {t("Angegeben")}{" "}
                                          <strong>
                                            {decimal(
                                              String(f.parameters.declared),
                                            )}
                                          </strong>
                                        </span>
                                        <span>
                                          {t("Berechnet")}{" "}
                                          <strong>
                                            {decimal(
                                              String(f.parameters.computed),
                                            )}
                                          </strong>
                                        </span>
                                      </div>
                                    )}
                                    <details>
                                      <summary>
                                        {t("Technische Details")}
                                      </summary>
                                      {Boolean(
                                        f.parameters.message ||
                                        f.parameters.reason,
                                      ) && (
                                        <p>
                                          <strong>
                                            {t(
                                              "Originaldiagnose (unverändert)",
                                            )}
                                          </strong>
                                          <br />
                                          {String(
                                            f.parameters.message ??
                                              f.parameters.reason,
                                          )}
                                        </p>
                                      )}
                                      <p>
                                        {t("Code:")} {f.code} ·{" "}
                                        {t(
                                          {
                                            ERROR: "Fehler",
                                            WARNING: "Warnung",
                                            INFO: "Information",
                                          }[f.severity],
                                        )}
                                      </p>
                                      <p>
                                        {t("Quelle:")}{" "}
                                        {f.sourcePath ?? t("Nicht zugeordnet")}
                                      </p>
                                      {f.ruleId && (
                                        <p>
                                          {t("Regel:")} {f.ruleId}
                                        </p>
                                      )}
                                      {f.evidenceSource && (
                                        <p>
                                          {t("Nachweis:")} {f.evidenceSource}
                                        </p>
                                      )}
                                    </details>
                                  </div>
                                </div>
                              ))}
                            {!findings.some((f) => f.layer === layer) && (
                              <p className="muted">
                                {layer === "SYSTEM"
                                  ? t("Keine technischen Fehler gemeldet.")
                                  : r.validationRuns[0]?.status === "PASS"
                                    ? t("Keine Fehler gemeldet.")
                                    : t(
                                        "Keine Ergebnisse für diese Ebene vorhanden.",
                                      )}
                              </p>
                            )}
                          </div>
                        ),
                      )
                    )}
                  </div>
                </section>
              )}
              {tab === "source" && (
                <section className="panel">
                  <div className="panel-title">
                    <div>
                      <h2>{t("Quelle & kanonische Daten")}</h2>
                      <p>
                        {t(
                          "Unveränderlicher Datenstand der ausgewählten Revision.",
                        )}{" "}
                      </p>
                    </div>
                    <button
                      className="secondary"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(JSON.stringify(invoice, null, 2))
                          .then(() => setToast("JSON kopiert."))
                          .catch(setError)
                      }
                    >
                      <Copy size={15} />
                      {t("JSON kopieren")}{" "}
                    </button>
                  </div>
                  <div className="panel-body">
                    {focusPath && (
                      <div className="notice" role="status">
                        <Info size={18} />
                        <div>
                          <strong>
                            {t("Betroffenes Feld:")} {focusPath}
                          </strong>
                          <p>
                            {JSON.stringify(
                              focusPath
                                .split(".")
                                .reduce((v: any, k: string) => v?.[k], invoice),
                            ) ?? t("Nicht angegeben")}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="hash-grid">
                      <div>
                        <small>{t("SHA-256 · Originalquelle")}</small>
                        <code>{r.sourceArtifact.sha256}</code>
                      </div>
                      <div>
                        <small>{t("SHA-256 · Canonical JSON")}</small>
                        <code>{r.canonicalSha256}</code>
                      </div>
                    </div>
                    <pre className="json-view">
                      {JSON.stringify(invoice, null, 2)}
                    </pre>
                  </div>
                </section>
              )}
              {tab === "artifacts" && (
                <section className="panel">
                  <div className="panel-title">
                    <div>
                      <h2>{t("Artefakte & Nachweise")}</h2>
                      <p>
                        {t(
                          "Exakte XML-Bytes und reproduzierbare Prüfnachweise.",
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="panel-body">
                    {r.artifacts.length ? (
                      r.artifacts.map((a: any) => (
                        <div className="artifact" key={a.artifactId}>
                          <span className="file-icon">
                            <FileCheck2 size={23} />
                          </span>
                          <div>
                            <h3>XRechnung UBL</h3>
                            <p>XRechnung 3.0.2 · fakturapass-ubl/1.0.0</p>
                            <code>{a.sha256}</code>
                          </div>
                          <a
                            className="secondary"
                            href={`/api/v1/artifacts/${a.artifactId}/download`}
                          >
                            <Download size={16} />
                            XML
                          </a>
                        </div>
                      ))
                    ) : (
                      <div className="notice">
                        <Info size={19} />
                        <p>
                          {t(
                            "Nach erfolgreicher Prüfung und Freigabe können Sie das XRechnung-Artefakt erstellen.",
                          )}{" "}
                        </p>
                      </div>
                    )}
                    {r.validationRuns.some((v: any) =>
                      ["PASS", "FAIL"].includes(v.status),
                    ) && (
                      <div className="artifact">
                        <span className="file-icon">
                          <FileJson size={23} />
                        </span>
                        <div>
                          <h3>{t("Evidenzmanifest")}</h3>
                          <p>
                            {t(
                              "Prüfsummen, Regelversionen, vollständiger Validatorbericht und Befunde.",
                            )}{" "}
                          </p>
                        </div>
                        <a
                          className="secondary"
                          href={`/api/v1/invoices/${selected.invoiceId}/evidence?revisionId=${r.revisionId}`}
                        >
                          <Download size={16} />
                          {t("Nachweis")}{" "}
                        </a>
                      </div>
                    )}
                  </div>
                </section>
              )}
              {tab === "history" && (
                <section className="panel">
                  <div className="panel-title">
                    <h2>{t("Unveränderlicher Verlauf")}</h2>
                    <span className="muted">
                      {t(
                        selected.revisions.length === 1
                          ? "{count} Revision"
                          : "{count} Revisionen",
                        { count: selected.revisions.length },
                      )}
                    </span>
                  </div>
                  <div className="panel-body timeline">
                    {selected.revisions.map((rev: any) => (
                      <div className="timeline-item" key={rev.revisionId}>
                        <span className="timeline-dot" />
                        <div>
                          <h3>
                            {t("Revision")} {rev.revisionNumber}{" "}
                            <Badge status={rev.status} />
                          </h3>
                          <small>
                            {date(rev.createdAt)} ·{" "}
                            {new Date(rev.createdAt).toLocaleTimeString(
                              intlLocale,
                            )}
                          </small>
                          <code>{rev.canonicalSha256}</code>
                          <button
                            className="text-button"
                            onClick={async () => {
                              setBusy(true);
                              try {
                                const historical = await api(
                                  `invoices/${selected.invoiceId}/revisions/${rev.revisionId}`,
                                );
                                setSelected({
                                  ...selected,
                                  currentRevision: historical,
                                });
                                setTab("source");
                              } catch (e) {
                                setError(e);
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            {t("Datenstand ansehen")} <ArrowUpRight size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {r.validationRuns.map((v: any) => (
                      <div className="timeline-item" key={v.validationRunId}>
                        <span className="timeline-dot" />
                        <div>
                          <h3>
                            {v.kind === "ARTIFACT"
                              ? t("Artefaktprüfung")
                              : t("Revisionsprüfung")}{" "}
                            <Badge status={v.status} />
                          </h3>
                          <small>
                            {date(v.createdAt)} · {v.engineVersion}
                          </small>
                        </div>
                      </div>
                    ))}
                    {r.approval && (
                      <div className="timeline-item">
                        <span className="timeline-dot" />
                        <div>
                          <h3>{t("Revision freigegeben")}</h3>
                          <small>
                            {r.approval.approver_subject} ·{" "}
                            {date(r.approval.approved_at)}
                          </small>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </>
          )}
          {view === "settings" && (
            <>
              <div className="page-heading">
                <div className="eyebrow">{t("UMGEBUNG & TRANSPARENZ")}</div>
                <h1>{t("Ein klar definierter Prüfstand.")}</h1>
                <p>
                  {t(
                    "Versionen, unterstützte Fälle und Grenzen dieses Demonstrators.",
                  )}{" "}
                </p>
              </div>
              <div className="settings-grid">
                <details className="panel technical-information">
                  <summary>{t("Technische Informationen")}</summary>
                  <div className="panel-body">
                    <dl>
                      {[
                        [t("Umgebung"), t("Lokale Installation")],
                        [t("Kanonisches Schema"), "fakturapass.invoice.v1"],
                        [t("Generator"), "fakturapass-ubl/1.0.0"],
                        [t("Offizieller Validator"), "KoSIT 1.6.3"],
                        [t("Regelpaket"), "XRechnung 3.0.2 · 2026-01-31"],
                        [t("Datenbank"), "PostgreSQL 17"],
                        [
                          t("Verarbeitung"),
                          t("Dauerhafte PostgreSQL-Auftragswarteschlange"),
                        ],
                      ].map(([a, b]) => (
                        <div key={a}>
                          <dt>{a}</dt>
                          <dd>{b}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </details>
                <section className="panel">
                  <div className="panel-title">
                    <h2>{t("Unterstützter Umfang")}</h2>
                  </div>
                  <div className="panel-body scope">
                    <p>
                      <CheckCircle2 size={17} />
                      {t("Deutsche Inlandsrechnungen in EUR")}{" "}
                    </p>
                    <p>
                      <CheckCircle2 size={17} />
                      {t("Explizite Standard-Umsatzsteuer 19 %")}{" "}
                    </p>
                    <p>
                      <CheckCircle2 size={17} />
                      {t("Canonical JSON, XRechnung UBL, Evidenz")}{" "}
                    </p>
                    <p>
                      <Info size={17} />
                      {t("Reduzierte Steuersätze: Freigabe ausstehend")}{" "}
                    </p>
                    <p>
                      <Info size={17} />
                      {t("Kein Versand, Peppol oder ZUGFeRD")}{" "}
                    </p>
                    <div className="notice">
                      <ShieldCheck size={20} />
                      <p>
                        {t(
                          "Dieser Demonstrator versendet keine Rechnungen und erteilt keine Steuer- oder Rechtsberatung. Empfängerprofile sind ausschließlich synthetisch.",
                        )}{" "}
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </>
          )}
          <footer className="footer">
            <span>
              FakturaPass <span>·</span>
              {t("Von der Quelle zum Nachweis.")}{" "}
            </span>
            <span>
              <span className={`dot ${health ? "healthy" : ""}`} />
              {health
                ? t("Lokale Dienste verbunden")
                : t("Lokale Dienste werden geprüft")}
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {t(toast)}
        </div>
      )}
    </div>
  );
}
