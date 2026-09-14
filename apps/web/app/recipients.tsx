"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "./language";
import { apiErrorKeys } from "../../../packages/i18n";
export const coverageLabels: Record<string, string> = {
  UNKNOWN: "Empfänger unbekannt",
  SYNTHETIC: "Anforderungen nicht verifiziert",
  UNVERIFIED: "Anforderungen nicht verifiziert",
  VERIFIED: "Anforderungen belegt",
  TENANT_VERIFIED: "Vom eigenen Team geprüft",
  EXPIRED: "Nachweis abgelaufen",
  RETIRED: "Profil zurückgezogen",
  SUPERSEDED: "Neuere Version verfügbar",
  NOT_YET_EFFECTIVE: "Noch nicht gültig",
  MISMATCH: "Empfänger stimmt nicht überein",
  UNSUPPORTED_ROUTE: "Ausgabeweg nicht unterstützt",
};
const referenceFields = {
  "document.buyerReference": "Käuferreferenz",
  "document.purchaseOrderReference": "Bestellreferenz",
  "document.contractReference": "Vertragsreferenz",
  "buyer.electronicAddress.value": "Elektronische Empfängeradresse",
  "payment.paymentReference": "Zahlungsreferenz",
};
export function profileName(profile: any, t: (key: string) => string) {
  const keys: Record<string, string> = {
    "synthetic-reference-v1": "Demo · Käuferreferenz",
    "synthetic-po-v1": "Demo · Bestellbezug",
    "synthetic-contract-v1": "Demo · Vertragsbezug",
  };
  return profile.status === "SYNTHETIC"
    ? t(keys[profile.versionId] || profile.displayName)
    : profile.displayName;
}
export function ProfileDetails({ profile }: { profile: any }) {
  const { t, date } = useLanguage();
  return (
    <div className="profile-details">
      <p>
        {t(
          coverageLabels[profile.coverage || profile.status] ||
            coverageLabels.UNKNOWN,
        )}{" "}
        · {t("Version")} {profile.version}
      </p>
      <p>
        {profile.identifiers
          .map((i: any) => `${i.schemeId}: ${i.value}`)
          .join(" · ")}
      </p>
      <p>
        {t("Akzeptierte Ausgabe")}:{" "}
        {profile.accepted.syntaxes
          .map((s: string) => (s === "XRECHNUNG_UBL" ? "XRechnung UBL" : s))
          .join(", ")}{" "}
        ·{" "}
        {profile.accepted.channels
          .map((s: string) => (s === "DOWNLOAD" ? "Download" : s))
          .join(", ")}
      </p>
      {profile.expiresAt && (
        <p>
          {t("Erneut prüfen bis")}: {date(profile.expiresAt)}
        </p>
      )}
      <ul>
        {profile.requirements.map((r: any) => (
          <li key={r.id}>
            {t((referenceFields as any)[r.fieldPath] || r.fieldPath)} ·{" "}
            {t(r.severity === "ERROR" ? "Erforderlich" : "Hinweis")}
          </li>
        ))}
      </ul>
      {!profile.evidence.length ? (
        <p>
          {t(
            "Für diesen Empfänger liegen keine verifizierten Anforderungen vor.",
          )}
        </p>
      ) : (
        profile.evidence.map((e: any, n: number) => (
          <div className="profile-evidence" key={n}>
            <strong>{e.title}</strong>
            <p>{e.urlOrReference}</p>
            <small>
              {t("Abgerufen")}: {date(e.retrievedAt)} ·{" "}
              {t("Nachweis geprüft am")}: {date(e.reviewedAt)}
            </small>
            {e.effectiveFrom && (
              <p>
                {t("Gültig ab")}: {date(e.effectiveFrom)}
              </p>
            )}
          </div>
        ))
      )}
      <p>
        {t("Belegte Anforderungen sind keine Annahmezusage des Empfängers.")}
      </p>
    </div>
  );
}
export function Recipients({ onChanged }: { onChanged: () => void }) {
  const { t } = useLanguage();
  const [items, setItems] = useState<any[]>([]),
    [versions, setVersions] = useState<any[]>([]),
    [draft, setDraft] = useState<any>(null),
    [prior, setPrior] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [attest, setAttest] = useState(false),
    [saved, setSaved] = useState(false);
  async function call(path: string, body?: any) {
    const r = await fetch(
      `/api/v1/recipient-profiles${path}`,
      body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {},
    );
    const data = await r.json();
    if (!r.ok) throw Error(data.error?.code || "INTERNAL_ERROR");
    return data;
  }
  async function load() {
    try {
      setItems((await call("")).items);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  function edit(p?: any) {
    setSaved(false);
    setError("");
    setAttest(false);
    setPrior(p?.versionId ?? null);
    setDraft(
      p
        ? {
            recipientKey: p.recipientKey,
            displayName: p.displayName,
            status: p.status,
            identifiers: p.identifiers,
            accepted: p.accepted,
            requirements: p.requirements,
            evidence: p.evidence,
            expiresAt: p.expiresAt,
          }
        : {
            recipientKey: "",
            displayName: "",
            status: "UNVERIFIED",
            identifiers: [{ schemeId: "", value: "" }],
            accepted: {
              syntaxes: ["XRECHNUNG_UBL"],
              profiles: ["XRECHNUNG"],
              channels: ["DOWNLOAD"],
            },
            requirements: [],
            evidence: [],
            expiresAt: null,
          },
    );
  }
  const update = (key: string, value: any) =>
    setDraft({ ...draft, [key]: value });
  const evidence = draft?.evidence[0] || {
    sourceType: "RECIPIENT_INSTRUCTIONS",
    title: "",
    urlOrReference: "",
    retrievedAt: "",
    effectiveFrom: null,
    reviewedAt: "",
  };
  const updateEvidence = (key: string, value: any) =>
    update("evidence", [
      { ...evidence, [key]: value },
      ...draft.evidence.slice(1),
    ]);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t("EMPFÄNGER")}</div>
          <h1>{t("Empfängeranforderungen")}</h1>
          <p>
            {t("Anforderungen, Quellen und frühere Versionen an einem Ort.")}
          </p>
        </div>
        <button className="primary" onClick={() => edit()}>
          {t("Empfänger hinzufügen")}
        </button>
      </div>
      {error && (
        <p role="alert" className="error-banner">
          {t(apiErrorKeys[error] || error)}
        </p>
      )}
      {saved && (
        <p role="status">
          {t(
            "Profilversion gespeichert. Geänderte Anforderungen erfordern eine neue Prüfung.",
          )}
        </p>
      )}
      {draft && (
        <form
          className="panel recipient-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await call("", { profile: draft, priorVersionId: prior });
              setDraft(null);
              setSaved(true);
              await load();
              onChanged();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="panel-title">
            <h2>{t(prior ? "Neue Profilversion" : "Empfänger hinzufügen")}</h2>
          </div>
          <div className="panel-body">
            <fieldset disabled={busy}>
              <div className="editor-fields">
                <label className="editor-field">
                  {t("Name")}
                  <input
                    required
                    value={draft.displayName}
                    onChange={(e) => update("displayName", e.target.value)}
                  />
                </label>
                <label className="editor-field">
                  {t("Profilkennung")}
                  <input
                    required
                    pattern="[a-z0-9]([a-z0-9]|-){0,79}"
                    readOnly={!!prior}
                    value={draft.recipientKey}
                    onChange={(e) => update("recipientKey", e.target.value)}
                  />
                </label>
                <label className="editor-field">
                  {t("Adressschema")}
                  <input
                    required
                    value={draft.identifiers[0].schemeId}
                    onChange={(e) =>
                      update("identifiers", [
                        { ...draft.identifiers[0], schemeId: e.target.value },
                        ...draft.identifiers.slice(1),
                      ])
                    }
                  />
                </label>
                <label className="editor-field">
                  {t("Elektronische Empfängeradresse")}
                  <input
                    required
                    value={draft.identifiers[0].value}
                    onChange={(e) =>
                      update("identifiers", [
                        { ...draft.identifiers[0], value: e.target.value },
                        ...draft.identifiers.slice(1),
                      ])
                    }
                  />
                </label>
                <label className="editor-field">
                  {t("Nachweisstatus")}
                  <select
                    aria-label={t("Nachweisstatus")}
                    value={draft.status}
                    onChange={(e) => update("status", e.target.value)}
                  >
                    <option value="UNVERIFIED">
                      {t("Anforderungen nicht verifiziert")}
                    </option>
                    <option value="TENANT_VERIFIED">
                      {t("Vom eigenen Team geprüft")}
                    </option>
                    <option value="RETIRED">{t("Profil zurückgezogen")}</option>
                  </select>
                </label>
                <label className="editor-field">
                  {t("Erneut prüfen bis")}
                  <input
                    type="date"
                    min={
                      draft.status === "TENANT_VERIFIED"
                        ? new Date(Date.now() + 86400000)
                            .toISOString()
                            .slice(0, 10)
                        : undefined
                    }
                    required={draft.status === "TENANT_VERIFIED"}
                    value={draft.expiresAt?.slice(0, 10) || ""}
                    onChange={(e) =>
                      update(
                        "expiresAt",
                        e.target.value
                          ? `${e.target.value}T00:00:00.000Z`
                          : null,
                      )
                    }
                  />
                </label>
              </div>
              <p>{t("Pflichtangaben laut Empfänger")}</p>
              <div className="recipient-checks">
                {Object.entries(referenceFields).map(([field, label]) => (
                  <label key={field}>
                    <input
                      type="checkbox"
                      checked={draft.requirements.some(
                        (r: any) => r.fieldPath === field,
                      )}
                      onChange={(e) =>
                        update(
                          "requirements",
                          e.target.checked
                            ? [
                                ...draft.requirements,
                                {
                                  id: field,
                                  fieldPath: field,
                                  predicate: "PRESENT",
                                  severity: "ERROR",
                                  messageKey: "RECIPIENT_REQUIREMENT_MISSING",
                                },
                              ]
                            : draft.requirements.filter(
                                (r: any) => r.fieldPath !== field,
                              ),
                        )
                      }
                    />
                    {t(label)}
                  </label>
                ))}
              </div>
              <h3>{t("Quelle der Anforderungen")}</h3>
              <div className="editor-fields">
                <label className="editor-field">
                  {t("Quellentitel")}
                  <input
                    required={
                      draft.status === "TENANT_VERIFIED" ||
                      draft.evidence.length > 0
                    }
                    value={evidence.title}
                    onChange={(e) => updateEvidence("title", e.target.value)}
                  />
                </label>
                <label className="editor-field">
                  {t("Link oder Dokumentreferenz")}
                  <input
                    required={
                      draft.status === "TENANT_VERIFIED" ||
                      draft.evidence.length > 0
                    }
                    value={evidence.urlOrReference}
                    onChange={(e) =>
                      updateEvidence("urlOrReference", e.target.value)
                    }
                  />
                </label>
                {[
                  ["retrievedAt", "Abgerufen"],
                  ["reviewedAt", "Nachweis geprüft am"],
                  ["effectiveFrom", "Gültig ab"],
                ].map(([key, label]) => (
                  <label className="editor-field" key={key}>
                    {t(label)}
                    <input
                      type="date"
                      max={
                        key !== "effectiveFrom"
                          ? new Date().toISOString().slice(0, 10)
                          : undefined
                      }
                      min={
                        key === "reviewedAt"
                          ? evidence.retrievedAt?.slice(0, 10)
                          : undefined
                      }
                      required={
                        key !== "effectiveFrom" &&
                        (draft.status === "TENANT_VERIFIED" ||
                          draft.evidence.length > 0)
                      }
                      value={evidence[key]?.slice(0, 10) || ""}
                      onChange={(e) =>
                        updateEvidence(
                          key,
                          e.target.value
                            ? `${e.target.value}T00:00:00.000Z`
                            : null,
                        )
                      }
                    />
                  </label>
                ))}
              </div>
              <p>
                {t(
                  "Belegte Anforderungen sind keine Annahmezusage des Empfängers.",
                )}
              </p>
              {draft.status === "TENANT_VERIFIED" && (
                <label className="recipient-attest">
                  <input
                    type="checkbox"
                    checked={attest}
                    onChange={(e) => setAttest(e.target.checked)}
                  />
                  {t(
                    "Ich habe die Quelle und ihre Gültigkeit für diesen Empfänger geprüft.",
                  )}
                </label>
              )}
              <div className="action-row">
                <button
                  type="submit"
                  className="primary"
                  disabled={
                    busy || (draft.status === "TENANT_VERIFIED" && !attest)
                  }
                >
                  {t("Profilversion speichern")}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setDraft(null)}
                >
                  {t("Abbrechen")}
                </button>
              </div>
            </fieldset>
          </div>
        </form>
      )}
      <div className="recipient-grid">
        {items.map((p) => (
          <section className="panel" key={p.versionId}>
            <div className="panel-title">
              <h2>{profileName(p, t)}</h2>
            </div>
            <div className="panel-body">
              <ProfileDetails profile={p} />
              {p.status !== "SYNTHETIC" && (
                <button className="secondary" onClick={() => edit(p)}>
                  {t("Neue Profilversion")}
                </button>
              )}
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    setVersions(
                      (
                        await call(
                          `/${encodeURIComponent(p.recipientKey)}/versions`,
                        )
                      ).items,
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {t("Versionsverlauf")}
              </button>
            </div>
          </section>
        ))}
      </div>
      {versions.length > 0 && (
        <section className="panel">
          <div className="panel-title">
            <h2>{t("Versionsverlauf")}</h2>
            <button className="secondary" onClick={() => setVersions([])}>
              {t("Schließen")}
            </button>
          </div>
          <div className="panel-body">
            {versions.map((p) => (
              <details key={p.versionId}>
                <summary>
                  {profileName(p, t)} · {t("Version")} {p.version}
                </summary>
                <ProfileDetails profile={p} />
                <small>
                  {t("Veröffentlicht von")}: {p.createdBy || "—"} · SHA-256:{" "}
                  {p.sha256}
                </small>
              </details>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
